import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/client.js';
import { formatTimestamp, warnMessage } from '../lib/formatter.js';
import { handleApiError } from '../lib/errors.js';

/**
 * Common tweet fields and expansions for timeline requests.
 */
const TWEET_OPTIONS = {
  'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
  'user.fields': ['name', 'username'],
  expansions: ['author_id'],
};

/**
 * Build a lookup map from included users.
 */
function buildUserMap(includes) {
  const map = new Map();
  if (includes?.users) {
    for (const user of includes.users) {
      map.set(user.id, user);
    }
  }
  return map;
}

/**
 * Highlight mentions and hashtags in tweet text.
 */
function highlightText(text) {
  return text
    .replace(/@(\w+)/g, chalk.cyan('@$1'))
    .replace(/#(\w+)/g, chalk.blue('#$1'));
}

/**
 * Render tweets into a cli-table3 table and print it.
 */
function renderTable(tweets, userMap) {
  const table = new Table({
    head: [
      chalk.bold('Author'),
      chalk.bold('Tweet'),
      chalk.bold('Time'),
      chalk.bold('Likes'),
      chalk.bold('RTs'),
    ],
    colWidths: [18, 50, 14, 8, 8],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const tweet of tweets) {
    const user = userMap.get(tweet.author_id);
    const author = user ? `@${user.username}` : tweet.author_id || '?';
    const text = highlightText(tweet.text || '');
    const time = tweet.created_at ? formatTimestamp(tweet.created_at) : '';
    const likes = tweet.public_metrics?.like_count ?? 0;
    const rts = tweet.public_metrics?.retweet_count ?? 0;

    table.push([
      chalk.cyan(author),
      text,
      chalk.dim(time),
      likes > 0 ? chalk.red(String(likes)) : chalk.dim('0'),
      rts > 0 ? chalk.green(String(rts)) : chalk.dim('0'),
    ]);
  }

  console.log(table.toString());
}

export const timelineCommand = new Command('timeline')
  .description('View your home timeline')
  .option('--mentions', 'Show mentions instead of home timeline')
  .option('-l, --limit <count>', 'Number of tweets to show', '20')
  .action(async (options) => {
    const spinner = ora('Fetching timeline...').start();
    try {
      const { roClient, client } = getClient();
      const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);

      let result;

      if (options.mentions) {
        spinner.text = 'Fetching mentions...';
        // Need the authenticated user's ID for mentions
        const me = await client.v2.me();
        result = await roClient.v2.userMentionTimeline(me.data.id, {
          max_results: limit,
          ...TWEET_OPTIONS,
        });
      } else {
        // Reverse chronological home timeline
        result = await roClient.v2.homeTimeline({
          max_results: limit,
          ...TWEET_OPTIONS,
        });
      }

      spinner.succeed('Timeline loaded');

      const tweets = result.data?.data || [];
      if (tweets.length === 0) {
        warnMessage('No tweets found.');
        return;
      }

      const userMap = buildUserMap(result.data?.includes);
      const label = options.mentions ? 'Mentions' : 'Home Timeline';
      console.log(chalk.bold(`\n${label}`) + chalk.dim(` (${tweets.length} tweets)\n`));
      renderTable(tweets, userMap);
    } catch (error) {
      spinner.fail('Failed to fetch timeline');
      handleApiError(error);
      process.exitCode = 1;
    }
  });
