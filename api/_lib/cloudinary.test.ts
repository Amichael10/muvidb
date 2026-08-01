import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  collectCloudinaryCredentials,
  isExhaustedCredentialError,
  signCloudinaryParams,
} from './cloudinary.js';

/**
 * The expected signature is derived from a hand-written payload string rather
 * than from the implementation, so these tests verify the sorting and exclusion
 * rules instead of just restating whatever the code happens to produce.
 */
function expectedSignature(payload: string, secret: string): string {
  return createHash('sha1').update(`${payload}${secret}`).digest('hex');
}

describe('signCloudinaryParams', () => {
  it('builds "sorted k=v pairs + secret" and SHA-1s it', () => {
    expect(signCloudinaryParams({ public_id: 'sample_image', timestamp: 1315060510 }, 'abcd')).toBe(
      expectedSignature('public_id=sample_image&timestamp=1315060510', 'abcd'),
    );
  });

  it('excludes file, api_key, cloud_name and resource_type', () => {
    const withNoise = signCloudinaryParams(
      {
        timestamp: 1315060510,
        public_id: 'sample_image',
        file: 'https://example.com/a.jpg',
        api_key: '1234',
        cloud_name: 'demo',
        resource_type: 'image',
      },
      'abcd',
    );

    // Identical to the clean call: the excluded params must not reach the hash.
    expect(withNoise).toBe(expectedSignature('public_id=sample_image&timestamp=1315060510', 'abcd'));
  });

  it('sorts params rather than using insertion order', () => {
    expect(signCloudinaryParams({ timestamp: 2, background_removal: 'cloudinary_ai' }, 's')).toBe(
      expectedSignature('background_removal=cloudinary_ai&timestamp=2', 's'),
    );
  });

  it('is order-independent because params are sorted', () => {
    const a = signCloudinaryParams({ timestamp: 1, public_id: 'x' }, 's');
    const b = signCloudinaryParams({ public_id: 'x', timestamp: 1 }, 's');
    expect(a).toBe(b);
  });

  it('changes when the secret changes', () => {
    const a = signCloudinaryParams({ timestamp: 1 }, 'secret-a');
    const b = signCloudinaryParams({ timestamp: 1 }, 'secret-b');
    expect(a).not.toBe(b);
  });
});

describe('collectCloudinaryCredentials', () => {
  it('pairs each numbered key with its own cloud name', () => {
    const creds = collectCloudinaryCredentials({
      CLOUDINARY_CLOUD_NAME_1: 'cloud-one',
      CLOUDINARY_API_KEY_1: 'key1',
      CLOUDINARY_API_SECRET_1: 'secret1',
      CLOUDINARY_CLOUD_NAME_2: 'cloud-two',
      CLOUDINARY_API_KEY_2: 'key2',
      CLOUDINARY_API_SECRET_2: 'secret2',
    } as NodeJS.ProcessEnv);

    expect(creds.map(c => [c.cloudName, c.apiKey])).toEqual([
      ['cloud-one', 'key1'],
      ['cloud-two', 'key2'],
    ]);
  });

  it('applies a single shared cloud name to every numbered key pair', () => {
    const creds = collectCloudinaryCredentials({
      CLOUDINARY_CLOUD_NAME: 'only-cloud',
      CLOUDINARY_API_KEY_1: 'key1',
      CLOUDINARY_API_SECRET_1: 'secret1',
      CLOUDINARY_API_KEY_2: 'key2',
      CLOUDINARY_API_SECRET_2: 'secret2',
      CLOUDINARY_API_KEY_3: 'key3',
      CLOUDINARY_API_SECRET_3: 'secret3',
    } as NodeJS.ProcessEnv);

    expect(creds).toHaveLength(3);
    expect(new Set(creds.map(c => c.cloudName))).toEqual(new Set(['only-cloud']));
  });

  it('drops a key pair that has no cloud name to belong to', () => {
    // The current .env state: keys and secrets present, no cloud name anywhere.
    const creds = collectCloudinaryCredentials({
      CLOUDINARY_API_KEY_1: 'key1',
      CLOUDINARY_API_SECRET_1: 'secret1',
    } as NodeJS.ProcessEnv);

    expect(creds).toEqual([]);
  });

  it('drops a pair missing its secret', () => {
    const creds = collectCloudinaryCredentials({
      CLOUDINARY_CLOUD_NAME: 'c',
      CLOUDINARY_API_KEY_1: 'key1',
    } as NodeJS.ProcessEnv);

    expect(creds).toEqual([]);
  });

  it('deduplicates the same cloud and key appearing twice', () => {
    const creds = collectCloudinaryCredentials({
      CLOUDINARY_CLOUD_NAME: 'c',
      CLOUDINARY_API_KEY: 'key1',
      CLOUDINARY_API_SECRET: 'secret1',
      CLOUDINARY_API_KEY_1: 'key1',
      CLOUDINARY_API_SECRET_1: 'secret1',
    } as NodeJS.ProcessEnv);

    expect(creds).toHaveLength(1);
  });

  it('never puts a secret in the log label', () => {
    const creds = collectCloudinaryCredentials({
      CLOUDINARY_CLOUD_NAME_1: 'cloud-one',
      CLOUDINARY_API_KEY_1: 'key1',
      CLOUDINARY_API_SECRET_1: 'super-secret',
    } as NodeJS.ProcessEnv);

    expect(creds[0].label).not.toContain('super-secret');
    expect(creds[0].label).not.toContain('key1');
  });
});

describe('isExhaustedCredentialError', () => {
  it('rotates on rate limits and auth failures', () => {
    expect(isExhaustedCredentialError(420, '')).toBe(true);
    expect(isExhaustedCredentialError(429, '')).toBe(true);
    expect(isExhaustedCredentialError(401, 'Invalid credentials')).toBe(true);
  });

  it('rotates on an add-on quota message', () => {
    expect(isExhaustedCredentialError(400, 'Add-on usage limit exceeded')).toBe(true);
  });

  it('does not rotate on a genuine request error', () => {
    expect(isExhaustedCredentialError(400, 'Invalid image file')).toBe(false);
    expect(isExhaustedCredentialError(404, 'Resource not found')).toBe(false);
  });
});
