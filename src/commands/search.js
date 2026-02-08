import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/client.js';
import { formatTimestamp, warnMessage } from '../lib/formatter.js';
import { handleApiError } from '../lib/errors.js';

/**
 * Highlight mentions and hashtags in tweet text.
 */
function highlightText(text) {
  return text
    .replace(/@(\w+)/g, chalk.cyan('@$1'))
    .replace(/#(\w+)/g, chalk.blue('#$1'));
}

export const searchCommand = new Command('search')
  .description('Search tweets')
  .argument('<query>', 'Search query')
  .option('-l, --limit <count>', 'Number of results', '10')
  .action(async (query, options) => {
    const spinner = ora(`Searching for "${query}"...`).start();
    try {
      const { roClient } = getClient();
      const limit = Math.min(Math.max(parseInt(options.limit, 10) || 10, 1), 100);

      const result = await roClient.v2.search(query, {
        max_results: limit,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
        'user.fields': ['name', 'username'],
        expansions: ['author_id'],
      });

      spinner.succeed('Search complete');

      const tweets = result.data?.data || [];
      if (tweets.length === 0) {
        warnMessage('No tweets found.');
        return;
      }

      // Build user lookup
      const userMap = new Map();
      if (result.data?.includes?.users) {
        for (const user of result.data.includes.users) {
          userMap.set(user.id, user);
        }
      }

      console.log(chalk.bold(`\nSearch: "${query}"`) + chalk.dim(` (${tweets.length} results)\n`));

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
    } catch (error) {
      spinner.fail('Search failed');
      handleApiError(error);
      process.exitCode = 1;
    }
  });
