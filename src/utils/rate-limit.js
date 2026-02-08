import chalk from 'chalk';

/**
 * Parse rate limit information from a Twitter API response.
 */
export function parseRateLimitHeaders(response) {
  if (!response) return null;

  // twitter-api-v2 exposes rateLimit on the response object
  const rateLimit = response.rateLimit || response._rateLimit;

  if (!rateLimit) return null;

  return {
    limit: rateLimit.limit,
    remaining: rateLimit.remaining,
    reset: rateLimit.reset,
  };
}

/**
 * Check rate limit status and warn if running low.
 * Returns true if requests are available, false if exhausted.
 */
export function checkRateLimit(remaining, reset) {
  if (remaining === 0) {
    console.warn(
      chalk.yellow(
        `Rate limit exhausted. Resets ${formatResetTime(reset)}.`
      )
    );
    return false;
  }

  if (remaining <= 5) {
    console.warn(
      chalk.yellow(
        `Rate limit warning: ${remaining} requests remaining. Resets ${formatResetTime(reset)}.`
      )
    );
  }

  return true;
}

/**
 * Format a Unix timestamp as a human-readable countdown.
 */
export function formatResetTime(resetTimestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = resetTimestamp - now;

  if (diff <= 0) return 'now';

  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;

  if (minutes > 0) {
    return `in ${minutes}m ${seconds}s`;
  }
  return `in ${seconds}s`;
}
