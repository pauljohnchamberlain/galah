import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/client.js';
import { formatTweet, formatThread, errorMessage, warnMessage } from '../lib/formatter.js';
import { handleApiError } from '../lib/errors.js';

/**
 * Extract a tweet ID from a Twitter/X URL or return the raw ID.
 * Supports:
 *   https://twitter.com/user/status/123456789
 *   https://x.com/user/status/123456789
 *   123456789
 */
function extractTweetId(input) {
  const urlPattern = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
  const match = input.match(urlPattern);
  if (match) {
    return match[1];
  }
  // Assume it's a raw ID
  if (/^\d+$/.test(input)) {
    return input;
  }
  return null;
}

export const viewCommand = new Command('view')
  .description('View a specific tweet')
  .argument('<id>', 'Tweet ID or URL')
  .action(async (id) => {
    const tweetId = extractTweetId(id);
    if (!tweetId) {
      errorMessage('Invalid tweet ID or URL. Provide a numeric ID or a twitter.com/x.com URL.');
      process.exitCode = 1;
      return;
    }

    const spinner = ora('Fetching tweet...').start();
    try {
      const { roClient } = getClient();

      const result = await roClient.v2.singleTweet(tweetId, {
        'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'conversation_id', 'in_reply_to_user_id'],
        'user.fields': ['name', 'username', 'verified', 'public_metrics'],
        expansions: ['author_id', 'in_reply_to_user_id'],
      });

      spinner.succeed('Tweet loaded');

      const tweet = result.data;
      if (!tweet) {
        warnMessage('Tweet not found.');
        return;
      }

      // Resolve author from includes
      const users = result.includes?.users || [];
      const author = users.find((u) => u.id === tweet.author_id);

      // Build a display object that formatTweet understands
      const display = {
        ...tweet,
        user: author ? { name: author.name, screen_name: author.username } : undefined,
        name: author?.name,
      };

      console.log('');
      console.log(formatTweet(display));

      // Show author follower count if available
      if (author?.public_metrics) {
        const ap = author.public_metrics;
        console.log(
          chalk.dim(`  Followers: ${ap.followers_count.toLocaleString()}  Following: ${ap.following_count.toLocaleString()}`)
        );
      }

      // Thread context: if this tweet is part of a conversation, fetch more
      if (tweet.conversation_id && tweet.conversation_id !== tweet.id) {
        const threadSpinner = ora('Loading thread context...').start();
        try {
          const threadResult = await roClient.v2.search(`conversation_id:${tweet.conversation_id}`, {
            max_results: 20,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'in_reply_to_user_id'],
            'user.fields': ['name', 'username'],
            expansions: ['author_id'],
          });

          threadSpinner.succeed('Thread loaded');

          const threadTweets = threadResult.data?.data || [];
          if (threadTweets.length > 1) {
            const threadUsers = new Map();
            for (const u of threadResult.data?.includes?.users || []) {
              threadUsers.set(u.id, u);
            }

            // Enrich tweets with user info
            const enriched = threadTweets
              .map((t) => {
                const u = threadUsers.get(t.author_id);
                return {
                  ...t,
                  user: u ? { name: u.name, screen_name: u.username } : undefined,
                  name: u?.name,
                };
              })
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            console.log(chalk.bold.yellow(`\nThread (${enriched.length} tweets):`));
            console.log(formatThread(enriched));
          }
        } catch {
          threadSpinner.fail('Thread context unavailable');
        }
      }

      console.log('');
    } catch (error) {
      spinner.fail('Failed to fetch tweet');
      handleApiError(error);
      process.exitCode = 1;
    }
  });
