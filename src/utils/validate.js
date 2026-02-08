import { readFileSync, existsSync } from 'node:fs';
import { ValidationError } from '../lib/errors.js';

const MAX_TWEET_LENGTH = 280;

/**
 * Validate tweet text length. Returns the text if valid, throws ValidationError otherwise.
 */
export function validateTweetLength(text) {
  if (!text || text.trim().length === 0) {
    throw new ValidationError('Tweet text cannot be empty.');
  }

  if (text.length > MAX_TWEET_LENGTH) {
    throw new ValidationError(
      `Tweet is ${text.length} characters (max ${MAX_TWEET_LENGTH}). ` +
      `Over by ${text.length - MAX_TWEET_LENGTH} characters.`
    );
  }

  return text;
}

/**
 * Validate a thread (array of tweet texts). Returns the array if valid.
 */
export function validateThread(tweets) {
  if (!Array.isArray(tweets)) {
    throw new ValidationError('Thread must be an array of tweet texts.');
  }

  if (tweets.length === 0) {
    throw new ValidationError('Thread must contain at least one tweet.');
  }

  if (tweets.length > 25) {
    throw new ValidationError(
      `Thread has ${tweets.length} tweets (max 25).`
    );
  }

  tweets.forEach((text, i) => {
    try {
      validateTweetLength(text);
    } catch (err) {
      throw new ValidationError(`Tweet ${i + 1}: ${err.message}`);
    }
  });

  return tweets;
}

/**
 * Validate that a file exists and contains valid JSON. Returns parsed content.
 */
export function validateFile(filePath) {
  if (!existsSync(filePath)) {
    throw new ValidationError(`File not found: ${filePath}`);
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new ValidationError(`Invalid JSON in ${filePath}: ${err.message}`);
    }
    throw new ValidationError(`Cannot read file ${filePath}: ${err.message}`);
  }
}
