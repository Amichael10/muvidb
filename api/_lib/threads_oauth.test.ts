import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptThreadsToken, encryptThreadsToken, signThreadsState, verifyThreadsState } from './threads_oauth';

describe('Threads OAuth security helpers', () => {
  beforeEach(() => {
    process.env.THREAD_APP_SECRET = 'test-app-secret';
    process.env.THREAD_OAUTH_STATE_SECRET = 'test-oauth-state-secret';
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = 'test-encryption-secret-that-is-long-enough';
  });

  afterEach(() => {
    delete process.env.THREAD_APP_SECRET;
    delete process.env.THREAD_OAUTH_STATE_SECRET;
    delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  });

  it('signs and verifies a short-lived OAuth state', () => {
    const input = {
      actorId: 'admin-1',
      redirectUri: 'https://muvidb.com/api/social?task=threads_callback',
      createdAt: Date.now(),
      nonce: 'nonce-1',
    };
    expect(verifyThreadsState(signThreadsState(input))).toEqual(input);
  });

  it('rejects a modified OAuth state', () => {
    const state = signThreadsState({
      actorId: 'admin-1',
      redirectUri: 'https://muvidb.com/api/social?task=threads_callback',
      createdAt: Date.now(),
      nonce: 'nonce-1',
    });
    expect(() => verifyThreadsState(`${state}changed`)).toThrow(/could not be verified|invalid/i);
  });

  it('encrypts stored access tokens with authenticated encryption', () => {
    const encrypted = encryptThreadsToken({ accessToken: 'threads-secret-token' });
    expect(JSON.stringify(encrypted)).not.toContain('threads-secret-token');
    expect(decryptThreadsToken(encrypted)).toEqual({ accessToken: 'threads-secret-token' });
  });
});
