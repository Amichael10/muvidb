import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase.js';

type SocialActor = { id: string; email?: string; role: 'admin' };
type StoredToken = { accessToken: string };
type HttpError = Error & { status?: number };

const THREADS_SCOPES = ['threads_basic', 'threads_content_publish'];
const STATE_TTL_MS = 10 * 60 * 1000;

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function required(name: 'THREAD_APP_ID' | 'THREAD_APP_SECRET'): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw httpError(503, `${name} is not configured`);
  return value;
}

function encryptionKey(): Buffer {
  const material = String(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!material) throw httpError(503, 'Social token encryption is not configured');
  return createHash('sha256').update(material).digest();
}

function stateKey(): string {
  const value = String(process.env.THREAD_OAUTH_STATE_SECRET || '').trim();
  if (!value) throw httpError(503, 'Threads OAuth state security is not configured');
  return value;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function stateHash(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestOrigin(req: VercelRequest): string {
  const configured = String(process.env.PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) throw httpError(500, 'Unable to determine the OAuth callback host');
  return `${proto}://${host}`;
}

export function threadsRedirectUri(req: VercelRequest): string {
  const configured = String(process.env.THREAD_REDIRECT_URI || '').trim();
  return configured || `${requestOrigin(req)}/api/social?task=threads_callback`;
}

export function threadsAdminRedirect(req: VercelRequest, result: 'connected' | 'error', message?: string): string {
  const target = new URL('/admin/social', requestOrigin(req));
  target.searchParams.set('threads', result);
  if (message) target.searchParams.set('message', message.slice(0, 180));
  return target.toString();
}

type OAuthState = { actorId: string; redirectUri: string; createdAt: number; nonce: string };

export function signThreadsState(payload: OAuthState): string {
  const encoded = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', stateKey()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyThreadsState(state: string): OAuthState {
  const [encoded, signature, extra] = String(state || '').split('.');
  if (!encoded || !signature || extra) throw httpError(400, 'The Threads connection request is invalid');
  const expected = createHmac('sha256', stateKey()).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) throw httpError(400, 'The Threads connection request could not be verified');

  let payload: OAuthState;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw httpError(400, 'The Threads connection request is malformed');
  }
  if (!payload.actorId || !payload.redirectUri || !payload.createdAt || Date.now() - payload.createdAt > STATE_TTL_MS) {
    throw httpError(400, 'The Threads connection request has expired');
  }
  return payload;
}

export function encryptThreadsToken(token: StoredToken) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), 'utf8'), cipher.final()]);
  return {
    token_ciphertext: ciphertext.toString('base64'),
    token_iv: iv.toString('base64'),
    token_auth_tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptThreadsToken(row: any): StoredToken {
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.token_iv, 'base64'));
    decipher.setAuthTag(Buffer.from(row.token_auth_tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(row.token_ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext);
  } catch {
    throw httpError(503, 'The Threads connection must be reconnected');
  }
}

async function threadsFetch(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const error = httpError(response.status >= 500 ? 502 : 400, payload?.error?.message || 'Threads rejected the request');
    throw error;
  }
  return payload;
}

export function isThreadsLivePublishingEnabled(): boolean {
  return String(process.env.SOCIAL_PUBLISH_MODE || '').toLowerCase() === 'live'
    && ['true', '1', 'yes'].includes(String(process.env.SOCIAL_THREADS_PUBLISH_ENABLED || '').toLowerCase());
}

export function getThreadsConfiguration(req: VercelRequest) {
  const appConfigured = Boolean(process.env.THREAD_APP_ID && process.env.THREAD_APP_SECRET);
  const securityConfigured = Boolean(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY && process.env.THREAD_OAUTH_STATE_SECRET);
  return {
    appConfigured,
    securityConfigured,
    readyForConnection: appConfigured && securityConfigured,
    redirectUri: threadsRedirectUri(req),
    scopes: THREADS_SCOPES,
    livePublishingEnabled: isThreadsLivePublishingEnabled(),
  };
}

export async function createThreadsAuthorizationUrl(req: VercelRequest, actor: SocialActor): Promise<string> {
  const redirectUri = threadsRedirectUri(req);
  const state = signThreadsState({
    actorId: actor.id,
    redirectUri,
    createdAt: Date.now(),
    nonce: randomBytes(18).toString('hex'),
  });
  const { error } = await supabase.from('social_oauth_states').insert({
    state_hash: stateHash(state),
    provider: 'threads',
    actor_user_id: actor.id,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  const url = new URL('https://threads.net/oauth/authorize');
  url.searchParams.set('client_id', required('THREAD_APP_ID'));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', THREADS_SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function completeThreadsOAuth(req: VercelRequest) {
  const code = String(req.query.code || '');
  const rawState = String(req.query.state || '');
  const state = verifyThreadsState(rawState);
  if (!code) throw httpError(400, 'Threads did not return an authorization code');

  const { data: consumed, error: consumeError } = await supabase
    .from('social_oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('state_hash', stateHash(rawState))
    .eq('provider', 'threads')
    .eq('actor_user_id', state.actorId)
    .eq('redirect_uri', state.redirectUri)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('state_hash')
    .maybeSingle();
  if (consumeError) throw consumeError;
  if (!consumed) throw httpError(400, 'The Threads connection request has already been used or expired');

  const short = await threadsFetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required('THREAD_APP_ID'),
      client_secret: required('THREAD_APP_SECRET'),
      grant_type: 'authorization_code',
      redirect_uri: state.redirectUri,
      code,
    }),
  });

  const longUrl = new URL('https://graph.threads.net/access_token');
  longUrl.searchParams.set('grant_type', 'th_exchange_token');
  longUrl.searchParams.set('client_secret', required('THREAD_APP_SECRET'));
  longUrl.searchParams.set('access_token', short.access_token);
  const token = await threadsFetch(longUrl.toString());
  const accessToken = String(token.access_token || short.access_token || '');
  if (!accessToken) throw httpError(502, 'Threads did not return an access token');

  const apiVersion = String(process.env.THREADS_GRAPH_API_VERSION || 'v1.0');
  const profileUrl = new URL(`https://graph.threads.net/${apiVersion}/me`);
  profileUrl.searchParams.set('fields', 'id,username,name,threads_profile_picture_url,threads_biography');
  profileUrl.searchParams.set('access_token', accessToken);
  const profile = await threadsFetch(profileUrl.toString());
  if (!profile.id) throw httpError(502, 'Threads did not return an account ID');

  const expiresIn = Number(token.expires_in || short.expires_in || 0);
  const encrypted = encryptThreadsToken({ accessToken });
  const record = {
    platform: 'threads',
    display_name: profile.name || profile.username || 'Threads',
    username: profile.username || null,
    external_account_id: String(profile.id),
    profile_image_url: profile.threads_profile_picture_url || null,
    status: 'connected',
    granted_scopes: THREADS_SCOPES,
    token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    last_verified_at: new Date().toISOString(),
    connection_metadata: { biography: profile.threads_biography || null, token_type: token.token_type || 'bearer' },
    created_by: state.actorId,
    ...encrypted,
  };

  const { data, error } = await supabase
    .from('social_connections')
    .upsert(record, { onConflict: 'platform,external_account_id' })
    .select('id,platform,display_name,username,status,token_expires_at,last_verified_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getThreadsConnection() {
  const { data, error } = await supabase
    .from('social_connections')
    .select('id,platform,display_name,username,external_account_id,profile_image_url,status,granted_scopes,token_expires_at,last_verified_at,token_ciphertext,token_iv,token_auth_tag')
    .eq('platform', 'threads')
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getThreadsPublishingCredentials() {
  const connection = await getThreadsConnection();
  if (!connection) throw httpError(409, 'Connect the MuviDB Threads account before publishing');

  let { accessToken } = decryptThreadsToken(connection);
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  if (expiresAt && expiresAt <= Date.now()) {
    await supabase.from('social_connections').update({ status: 'expired' }).eq('id', connection.id);
    throw httpError(409, 'The Threads connection has expired. Reconnect it before publishing');
  }

  // Meta permits long-lived Threads tokens to be refreshed after their first
  // day. Refresh near expiry so scheduled posts do not suddenly stop.
  if (expiresAt && expiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    const refreshUrl = new URL('https://graph.threads.net/refresh_access_token');
    refreshUrl.searchParams.set('grant_type', 'th_refresh_token');
    refreshUrl.searchParams.set('access_token', accessToken);
    const refreshed = await threadsFetch(refreshUrl.toString());
    if (refreshed.access_token) {
      accessToken = String(refreshed.access_token);
      const encrypted = encryptThreadsToken({ accessToken });
      const nextExpiry = Number(refreshed.expires_in || 0)
        ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
        : connection.token_expires_at;
      const { error } = await supabase
        .from('social_connections')
        .update({ ...encrypted, token_expires_at: nextExpiry, last_verified_at: new Date().toISOString() })
        .eq('id', connection.id);
      if (error) throw error;
    }
  }

  return { connection, accessToken };
}

export async function disconnectThreads() {
  const { error } = await supabase
    .from('social_connections')
    .update({ status: 'revoked', token_ciphertext: null, token_iv: null, token_auth_tag: null })
    .eq('platform', 'threads')
    .eq('status', 'connected');
  if (error) throw error;
  return { disconnected: true };
}

export function sanitizeThreadsConnection(connection: any) {
  if (!connection) return null;
  return {
    id: connection.id,
    platform: connection.platform,
    displayName: connection.display_name,
    username: connection.username,
    profileImageUrl: connection.profile_image_url,
    status: connection.status,
    grantedScopes: connection.granted_scopes || [],
    tokenExpiresAt: connection.token_expires_at,
    lastVerifiedAt: connection.last_verified_at,
  };
}
