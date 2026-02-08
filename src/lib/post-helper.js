import { existsSync } from 'node:fs';
import ora from 'ora';
import { parseRateLimitHeaders, checkRateLimit } from '../utils/rate-limit.js';

export function tweetUrl(tweetId) {
  return `https://twitter.com/i/status/${tweetId}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(text, max = 40) {
  if (text.length <= max) return text;
  return text.substring(0, max) + '...';
}

export async function uploadMedia(client, mediaPath, options = {}) {
  if (!existsSync(mediaPath)) {
    throw new Error(`File not found: ${mediaPath}`);
  }

  const { silent } = options;
  const spinner = silent ? null : ora('Uploading media...').start();

  const isVideo = /\.(mp4|mov|avi|webm)$/i.test(mediaPath);
  const mediaId = await client.v1.uploadMedia(mediaPath, {
    ...(isVideo && { type: 'longmp4' }),
  });

  if (spinner) {
    spinner.succeed('Media uploaded');
  } else {
    console.log('Media uploaded');
  }

  return [mediaId];
}

export async function postSingleTweet(rwClient, text, options = {}) {
  const { mediaIds, silent } = options;
  const spinner = silent ? null : ora('Posting tweet...').start();

  const response = await rwClient.v2.tweet({
    text,
    ...(mediaIds && { media: { media_ids: mediaIds } }),
  });
  const tweetId = response.data.id;
  const url = tweetUrl(tweetId);

  if (spinner) {
    spinner.succeed('Tweet posted!');
  } else {
    console.log('Tweet posted!');
  }

  const rateLimit = parseRateLimitHeaders(response);
  if (rateLimit) {
    checkRateLimit(rateLimit.remaining, rateLimit.reset);
  }

  return { tweetId, url };
}

export async function postThreadTweets(rwClient, tweets, options = {}) {
  const { mediaIds, silent } = options;
  const posted = [];
  let previousTweetId = null;
  const spinner = silent ? null : ora('Starting thread...').start();

  try {
    for (let i = 0; i < tweets.length; i++) {
      const status = `Posting ${i + 1}/${tweets.length}: ${truncate(tweets[i])}`;
      if (spinner) {
        spinner.text = status;
      } else {
        console.log(status);
      }

      const payload = {
        text: tweets[i],
        ...(previousTweetId && {
          reply: { in_reply_to_tweet_id: previousTweetId },
        }),
        ...(i === 0 && mediaIds && { media: { media_ids: mediaIds } }),
      };

      const response = await rwClient.v2.tweet(payload);
      const tweetId = response.data.id;

      posted.push(tweetId);
      previousTweetId = tweetId;

      const rateLimit = parseRateLimitHeaders(response);
      if (rateLimit && rateLimit.remaining === 0) {
        if (spinner) spinner.stop();
        checkRateLimit(rateLimit.remaining, rateLimit.reset);
        if (spinner) spinner.start();
      }

      if (i < tweets.length - 1) {
        await sleep(500);
      }
    }

    const message = `Thread posted! ${tweets.length} tweets`;
    if (spinner) {
      spinner.succeed(message);
    } else {
      console.log(message);
    }

    return { posted, failedIndex: null, error: null, url: tweetUrl(posted[0]) };
  } catch (error) {
    const failedIndex = posted.length;
    const message = `Failed at tweet ${failedIndex + 1}/${tweets.length}`;
    if (spinner) {
      spinner.fail(message);
    } else {
      console.log(message);
    }

    return {
      posted,
      failedIndex,
      error,
      url: posted.length > 0 ? tweetUrl(posted[0]) : null,
    };
  }
}
