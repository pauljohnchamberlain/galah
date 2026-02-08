import Conf from 'conf';

const config = new Conf({ projectName: 'galah' });

const CREDENTIALS_KEY = 'credentials';
const PREFERENCES_KEY = 'preferences';

const ENV_KEYS = {
  apiKey: 'TWITTER_API_KEY',
  apiSecret: 'TWITTER_API_SECRET',
  accessToken: 'TWITTER_ACCESS_TOKEN',
  accessSecret: 'TWITTER_ACCESS_SECRET',
};

/**
 * Get stored credentials, with env var overrides taking precedence.
 * Returns null if no credentials are configured.
 */
export function getCredentials() {
  const stored = config.get(CREDENTIALS_KEY, null);

  const envCreds = {
    apiKey: process.env[ENV_KEYS.apiKey],
    apiSecret: process.env[ENV_KEYS.apiSecret],
    accessToken: process.env[ENV_KEYS.accessToken],
    accessSecret: process.env[ENV_KEYS.accessSecret],
  };

  const hasEnvCreds = envCreds.apiKey && envCreds.apiSecret;

  if (!stored && !hasEnvCreds) {
    return null;
  }

  return {
    ...(stored || {}),
    ...Object.fromEntries(
      Object.entries(envCreds).filter(([, v]) => v !== undefined)
    ),
  };
}

/**
 * Store credentials to disk.
 */
export function setCredentials(creds) {
  config.set(CREDENTIALS_KEY, creds);
}

/**
 * Remove all stored credentials.
 */
export function clearCredentials() {
  config.delete(CREDENTIALS_KEY);
}

/**
 * Get user preferences (e.g., default output format).
 */
export function getPreferences() {
  return config.get(PREFERENCES_KEY, {});
}

/**
 * Set user preferences (merges with existing).
 */
export function setPreferences(prefs) {
  const existing = getPreferences();
  config.set(PREFERENCES_KEY, { ...existing, ...prefs });
}

/**
 * Get the config file path (useful for debugging).
 */
export function getConfigPath() {
  return config.path;
}
