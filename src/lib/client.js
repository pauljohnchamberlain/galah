import { TwitterApi } from 'twitter-api-v2';
import { getCredentials } from './config.js';
import { AuthError } from './errors.js';

/**
 * Create an authenticated Twitter API client from stored/env credentials.
 * Returns { rwClient, roClient } for read-write and read-only access.
 * Throws AuthError if no credentials are configured.
 */
export function getClient() {
  const creds = getCredentials();

  if (!creds) {
    throw new AuthError(
      'No credentials found. Run `galah auth` to authenticate.'
    );
  }

  const { apiKey, apiSecret, accessToken, accessSecret } = creds;

  if (!apiKey || !apiSecret) {
    throw new AuthError(
      'API key and secret are required. Run `galah auth` to set them up.'
    );
  }

  let client;

  if (accessToken && accessSecret) {
    // OAuth 1.0a user context (full read-write access)
    client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken,
      accessSecret,
    });
  } else {
    // App-only / bearer token context
    client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });
  }

  const rwClient = client.readWrite;
  const roClient = client.readOnly;

  return { rwClient, roClient, client };
}
