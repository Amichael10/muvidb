import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  authenticated: true,
  role: 'admin',
  claimEmailSentAt: null as string | null,
  updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
}));

const rpcMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const sendEmailMock = vi.hoisted(() => vi.fn());
const notifyClaimMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase.js', () => {
  const from = vi.fn((table: string) => {
    const chain: any = {
      error: null,
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      update: vi.fn((patch: Record<string, unknown>) => {
        testState.updates.push({ table, patch });
        return chain;
      }),
      single: vi.fn(async () => {
        if (table === 'users') return { data: { role: testState.role }, error: null };
        if (table === 'profile_claims') {
          return { data: { approval_email_sent_at: testState.claimEmailSentAt }, error: null };
        }
        return { data: null, error: null };
      }),
      then: (resolve: (value: unknown) => void) => resolve({ data: null, error: null }),
    };
    return chain;
  });
  return {
    supabase: {
      auth: { getUser: getUserMock },
      from,
      rpc: rpcMock,
    },
  };
});

vi.mock('./actor_claim_email.js', () => ({
  sendActorClaimApprovedEmail: sendEmailMock,
}));

vi.mock('./actor_claim_notify.js', () => ({
  notifyActorClaimSubmission: notifyClaimMock,
}));

import { handleActorClaims } from './actor_claims_handler.js';

function request(body: Record<string, unknown>, authorization = 'Bearer valid-token') {
  return {
    method: 'POST',
    headers: { authorization, host: 'staging.muvidb.test' },
    body,
  } as any;
}

function response() {
  const result: any = { statusCode: 200, body: null, headers: {} };
  result.setHeader = vi.fn((name: string, value: string) => { result.headers[name] = value; });
  result.status = vi.fn((code: number) => { result.statusCode = code; return result; });
  result.json = vi.fn((body: unknown) => { result.body = body; return result; });
  result.end = vi.fn(() => result);
  return result;
}

describe('actor claims admin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.authenticated = true;
    testState.role = 'admin';
    testState.claimEmailSentAt = null;
    testState.updates.length = 0;
    getUserMock.mockImplementation(async () => testState.authenticated
      ? { data: { user: { id: 'admin-id' } }, error: null }
      : { data: { user: null }, error: new Error('invalid token') });
    rpcMock.mockResolvedValue({ data: null, error: null });
    sendEmailMock.mockResolvedValue({ ok: true, emailId: 'email-id' });
    notifyClaimMock.mockResolvedValue({ ok: true, skipped: false, messageId: 123 });
  });

  it('rejects requests without a valid bearer session', async () => {
    testState.authenticated = false;
    const res = response();
    await handleActorClaims(request({ action: 'approve-claim', id: 'claim-id' }), res);
    expect(res.statusCode).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects limited administrators', async () => {
    testState.role = 'admin_limited';
    const res = response();
    await handleActorClaims(request({ action: 'approve-claim', id: 'claim-id' }), res);
    expect(res.statusCode).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('allows an authenticated actor to notify only for their own submitted claim', async () => {
    testState.role = 'fan';
    getUserMock.mockResolvedValue({ data: { user: { id: 'actor-id' } }, error: null });
    const res = response();
    await handleActorClaims(request({ action: 'notify-new-claim', id: 'claim-id' }), res);

    expect(res.statusCode).toBe(200);
    expect(notifyClaimMock).toHaveBeenCalledWith('claim-id', { expectedUserId: 'actor-id' });
  });

  it('allows a full admin to retry a failed Telegram claim alert', async () => {
    const res = response();
    await handleActorClaims(request({ action: 'retry-claim-telegram', id: 'claim-id' }), res);

    expect(res.statusCode).toBe(200);
    expect(notifyClaimMock).toHaveBeenCalledWith('claim-id', { force: true });
  });

  it('approves a verified claim, sends email, and records delivery', async () => {
    rpcMock.mockResolvedValue({
      data: {
        claim_id: 'claim-id', email: 'actor@example.test', user_name: 'Ada Actor', person_name: 'Ada E2E',
      },
      error: null,
    });
    const res = response();
    await handleActorClaims(request({ action: 'approve-claim', id: 'claim-id' }), res);

    expect(res.statusCode).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('approve_actor_profile_claim', {
      p_claim_id: 'claim-id', p_admin_id: 'admin-id',
    });
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'actor@example.test', personName: 'Ada E2E',
    }));
    expect(testState.updates).toContainEqual(expect.objectContaining({
      table: 'profile_claims', patch: expect.objectContaining({ approval_email_sent_at: expect.any(String) }),
    }));
    expect(res.body.email.sent).toBe(true);
  });

  it('keeps claim approval successful when email delivery fails so it can be retried', async () => {
    rpcMock.mockResolvedValue({
      data: { claim_id: 'claim-id', email: 'actor@example.test', user_name: 'Ada', person_name: 'Ada E2E' },
      error: null,
    });
    sendEmailMock.mockResolvedValue({ ok: false, error: 'provider unavailable' });
    const res = response();
    await handleActorClaims(request({ action: 'approve-claim', id: 'claim-id' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toEqual({ sent: false, error: 'provider unavailable' });
    expect(testState.updates).not.toContainEqual(expect.objectContaining({
      patch: expect.objectContaining({ approval_email_sent_at: expect.any(String) }),
    }));
  });

  it('routes credit approval through the service-only review RPC', async () => {
    rpcMock.mockResolvedValue({ data: { request_id: 'request-id', status: 'approved' }, error: null });
    const res = response();
    await handleActorClaims(request({ action: 'approve-credit', id: 'request-id', note: 'Checked source' }), res);

    expect(res.statusCode).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('review_actor_credit_request', {
      p_request_id: 'request-id', p_admin_id: 'admin-id', p_decision: 'approve', p_note: 'Checked source',
    });
  });
});
