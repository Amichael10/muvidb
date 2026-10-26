import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), send: vi.fn(), configured: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
vi.mock('./meta_whatsapp.js', () => ({
  sendMetaWhatsAppTemplate: mocks.send, isWhatsAppConfigured: mocks.configured,
  normalizeWhatsAppNumber: (phone: string) => phone,
}));
import { dispatchMovieWhatsAppAlerts } from './whatsapp_movie_alerts';

function query(data: unknown, error: unknown = null) {
  const q: any = { then: (resolve: any) => Promise.resolve({ data, error }).then(resolve) };
  for (const method of ['select', 'eq', 'in', 'neq', 'gte', 'upsert']) q[method] = vi.fn(() => q);
  return q;
}

const context = { filmId: 'film', title: 'Film', slug: 'film-slug', releaseType: 'youtube' };

describe('WhatsApp cast and crew alerts', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); });

  function setup(logs: unknown[] = [], follows?: unknown[]) {
    const queries = [
      query([{ person_id: 'actor', people: { name: 'Actor' } }, { person_id: 'editor', people: { name: 'Editor' } }]),
      query(follows || [{ user_id: 'user', person_id: 'actor' }, { user_id: 'user', person_id: 'editor' }]),
      query([{ id: 'user', whatsapp_phone: '2348000000000', whatsapp_enabled: true }]),
      query(logs), query([]), query(null),
    ];
    for (const q of queries) mocks.from.mockReturnValueOnce(q);
    return queries;
  }

  it('sends one message for followed cast and crew with the required dynamic button', async () => {
    setup(); mocks.send.mockResolvedValue({ ok: true, messageId: 'message' });
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.sentCount).toBe(1);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      buttonUrlPayload: 'film-slug',
      bodyParameters: ['Actor & Editor', 'Film', 'on YouTube', 'https://muvidb.com/film/film-slug'],
    }));
  });

  it('skips previously sent alerts', async () => {
    const queries = setup([{ user_id: 'user', status: 'delivered', attempts: 1 }]);
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(queries[3].select).toHaveBeenCalledWith('user_id,status,attempts,next_retry_at');
    expect(result.skippedAlreadyNotified).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('records failed sends so the queue can retry them', async () => {
    const queries = setup(); mocks.send.mockResolvedValue({ ok: false, error: 'Meta unavailable' });
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.failedCount).toBe(1);
    expect(queries[5].upsert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed', error_message: 'Meta unavailable',
    }), { onConflict: 'user_id,film_id' });
  });

  it('respects disabled follows', async () => {
    setup([], [{ user_id: 'user', person_id: 'actor', notify_whatsapp: false }]);
    await dispatchMovieWhatsAppAlerts(context);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not resend permanent failures or retries scheduled for later', async () => {
    setup([{ user_id: 'user', status: 'failed', attempts: 1, next_retry_at: null }]);
    await dispatchMovieWhatsAppAlerts(context);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('retries a due temporary failure with an increased attempt count', async () => {
    const queries = setup([{ user_id: 'user', status: 'failed', attempts: 1, next_retry_at: '2020-01-01T00:00:00Z' }]);
    mocks.send.mockResolvedValue({ ok: true, messageId: 'retry-message' });
    await dispatchMovieWhatsAppAlerts(context);
    expect(queries[5].upsert).toHaveBeenCalledWith(expect.objectContaining({ attempts: 2, status: 'sent', next_retry_at: null }), { onConflict: 'user_id,film_id' });
  });

  it('defers a second film during the recipient marketing cooldown', async () => {
    const queries = setup();
    queries[4].then = (resolve: any) => Promise.resolve({
      data: [{ user_id: 'user', status: 'delivered', error_code: null, last_attempt_at: new Date().toISOString() }],
      error: null,
    }).then(resolve);
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.deferredCount).toBe(1);
    expect(result.nextDeferredAt).not.toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('fails visibly when credentials or database queries are unavailable', async () => {
    mocks.configured.mockReturnValue(false);
    await expect(dispatchMovieWhatsAppAlerts(context)).rejects.toThrow('not configured');
    mocks.configured.mockReturnValue(true);
    mocks.from.mockReturnValue(query(null, { message: 'database unavailable' }));
    await expect(dispatchMovieWhatsAppAlerts(context)).rejects.toThrow('database unavailable');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('a lost log write must not strand the other followers', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); });

  /** Two followers of the same film, each needing their own message. */
  function setupTwoUsers(logUpsertError: unknown) {
    const credits = query([{ person_id: 'actor', people: { name: 'Actor' } }]);
    const follows = query([{ user_id: 'u1', person_id: 'actor' }, { user_id: 'u2', person_id: 'actor' }]);
    const users = query([
      { id: 'u1', whatsapp_phone: '2348000000001', whatsapp_enabled: true },
      { id: 'u2', whatsapp_phone: '2348000000002', whatsapp_enabled: true },
    ]);
    const logs = query([]);
    const recentLogs = query([]);
    mocks.from.mockReturnValueOnce(credits).mockReturnValueOnce(follows)
      .mockReturnValueOnce(users).mockReturnValueOnce(logs).mockReturnValueOnce(recentLogs);
    // Every later from() is a log write, which keeps failing.
    mocks.from.mockReturnValue(query(null, logUpsertError));
  }

  it('still messages the second follower when the first log write fails', async () => {
    setupTwoUsers({ message: 'db unavailable' });
    mocks.send.mockResolvedValue({ ok: true, messageId: 'm' });

    const result = await dispatchMovieWhatsAppAlerts(context);

    // Both messages must go out: aborting after the first stranded everyone else.
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(result.sentCount).toBe(2);
    expect(result.unloggedSends).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].error).toMatch(/could not be saved/i);
  });

  it('does not report an unlogged send as a failure, which would resend the film', async () => {
    setupTwoUsers({ message: 'db unavailable' });
    mocks.send.mockResolvedValue({ ok: true, messageId: 'm' });
    const result = await dispatchMovieWhatsAppAlerts(context);
    // failedCount drives the queue's retry; counting these would resend to
    // everyone who already received the message.
    expect(result.failedCount).toBe(0);
  });

  it('retries the log write before giving up on it', async () => {
    const credits = query([{ person_id: 'actor', people: { name: 'Actor' } }]);
    const follows = query([{ user_id: 'u1', person_id: 'actor' }]);
    const users = query([{ id: 'u1', whatsapp_phone: '2348000000001', whatsapp_enabled: true }]);
    const logs = query([]);
    const recentLogs = query([]);
    mocks.from.mockReturnValueOnce(credits).mockReturnValueOnce(follows)
      .mockReturnValueOnce(users).mockReturnValueOnce(logs).mockReturnValueOnce(recentLogs);
    // Fail once, then succeed.
    mocks.from.mockReturnValueOnce(query(null, { message: 'transient' }))
      .mockReturnValue(query(null));
    mocks.send.mockResolvedValue({ ok: true, messageId: 'm' });

    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.sentCount).toBe(1);
    expect(result.unloggedSends).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('films whose credits have not been harvested yet', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); });

  it('reports creditsMissing so the queue waits instead of completing', async () => {
    mocks.from.mockReturnValueOnce(query([]));
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.creditsMissing).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not set creditsMissing when the film is credited but nobody follows the cast', async () => {
    mocks.from.mockReturnValueOnce(query([{ person_id: 'actor', people: { name: 'Actor' } }]))
      .mockReturnValueOnce(query([]));
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.creditsMissing).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('unreachable followers are counted', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); });

  it('counts a follower whose WhatsApp is switched off', async () => {
    mocks.from.mockReturnValueOnce(query([{ person_id: 'actor', people: { name: 'Actor' } }]))
      .mockReturnValueOnce(query([{ user_id: 'u1', person_id: 'actor' }]))
      .mockReturnValueOnce(query([{ id: 'u1', whatsapp_phone: '2348000000001', whatsapp_enabled: false }]))
      .mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.skippedNotReachable).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('counts a follower whose number is unusable', async () => {
    mocks.from.mockReturnValueOnce(query([{ person_id: 'actor', people: { name: 'Actor' } }]))
      .mockReturnValueOnce(query([{ user_id: 'u1', person_id: 'actor' }]))
      .mockReturnValueOnce(query([{ id: 'u1', whatsapp_phone: '123', whatsapp_enabled: true }]))
      .mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    const result = await dispatchMovieWhatsAppAlerts(context);
    expect(result.skippedNotReachable).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
