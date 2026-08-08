import type { SocialPlatform } from '../domain/platform-types';

export class SocialPlatformError extends Error {
  platform: SocialPlatform;
  code: string;
  retryable: boolean;
  reconnectRequired: boolean;
  details?: unknown;

  constructor(input: {
    platform: SocialPlatform;
    code: string;
    message: string;
    retryable?: boolean;
    reconnectRequired?: boolean;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'SocialPlatformError';
    this.platform = input.platform;
    this.code = input.code;
    this.retryable = Boolean(input.retryable);
    this.reconnectRequired = Boolean(input.reconnectRequired);
    this.details = input.details;
  }
}
