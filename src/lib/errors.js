import chalk from 'chalk';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends Error {
  constructor(resetTimestamp) {
    const resetDate = new Date(resetTimestamp * 1000);
    const message = `Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`;
    super(message);
    this.name = 'RateLimitError';
    this.resetTimestamp = resetTimestamp;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Handle Twitter API errors and display friendly messages.
 */
export function handleApiError(error) {
  // Twitter API v2 errors
  if (error?.data?.errors) {
    const apiErrors = error.data.errors;
    for (const err of apiErrors) {
      console.error(chalk.red(`API Error: ${err.message}`));
      if (err.detail) {
        console.error(chalk.dim(`  Detail: ${err.detail}`));
      }
    }
    return;
  }

  // Rate limit (429)
  if (error?.code === 429 || error?.rateLimit) {
    const reset = error.rateLimit?.reset || Math.floor(Date.now() / 1000) + 900;
    const resetDate = new Date(reset * 1000);
    const remaining = error.rateLimit?.remaining ?? 0;
    console.error(
      chalk.yellow(
        `Rate limit hit (${remaining} remaining). Resets at ${resetDate.toLocaleTimeString()}.`
      )
    );
    return;
  }

  // Auth errors (401, 403)
  if (error?.code === 401 || error?.statusCode === 401) {
    console.error(
      chalk.red('Authentication failed. Your credentials may be invalid or expired.')
    );
    console.error(chalk.dim('Run `galah auth` to re-authenticate.'));
    return;
  }

  if (error?.code === 403 || error?.statusCode === 403) {
    console.error(
      chalk.red('Forbidden. You may not have permission for this action.')
    );
    console.error(
      chalk.dim('Check your Twitter/X API access level at developer.twitter.com')
    );
    return;
  }

  // Not found (404)
  if (error?.code === 404 || error?.statusCode === 404) {
    console.error(chalk.red('Not found. The tweet or user may not exist.'));
    return;
  }

  // Network errors
  if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
    console.error(
      chalk.red('Network error. Check your internet connection.')
    );
    return;
  }

  if (error?.code === 'ETIMEDOUT' || error?.code === 'ESOCKETTIMEDOUT') {
    console.error(
      chalk.red('Request timed out. The Twitter API may be slow or unreachable.')
    );
    return;
  }

  // AuthError (our custom class)
  if (error instanceof AuthError) {
    console.error(chalk.red(error.message));
    return;
  }

  // ValidationError (our custom class)
  if (error instanceof ValidationError) {
    console.error(chalk.red(`Validation: ${error.message}`));
    return;
  }

  // Fallback
  console.error(chalk.red(`Error: ${error?.message || 'Unknown error occurred'}`));
  if (process.env.DEBUG) {
    console.error(chalk.dim(error?.stack || ''));
  }
}
