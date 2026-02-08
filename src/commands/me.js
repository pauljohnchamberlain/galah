import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../lib/client.js';
import { handleApiError } from '../lib/errors.js';

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const meCommand = new Command('me')
  .description('View your profile info')
  .action(async () => {
    const spinner = ora('Fetching your profile...').start();

    try {
      const { roClient } = getClient();

      const { data: user } = await roClient.v2.me({
        'user.fields': [
          'username',
          'name',
          'description',
          'public_metrics',
          'profile_image_url',
          'verified',
          'created_at',
          'location',
          'url',
        ],
      });

      spinner.succeed('Profile loaded');
      console.log();

      const metrics = user.public_metrics || {};

      const lines = [
        chalk.bold.white(user.name) +
          (user.verified ? chalk.blue(' \u2713') : '') +
          chalk.dim(` @${user.username}`),
      ];

      if (user.description) {
        lines.push('');
        lines.push(user.description);
      }

      lines.push('');

      const stats = [
        chalk.bold(formatCount(metrics.followers_count ?? 0)) +
          chalk.dim(' Followers'),
        chalk.bold(formatCount(metrics.following_count ?? 0)) +
          chalk.dim(' Following'),
        chalk.bold(formatCount(metrics.tweet_count ?? 0)) +
          chalk.dim(' Tweets'),
      ];
      lines.push(stats.join(chalk.dim('  |  ')));

      if (user.location || user.url) {
        lines.push('');
        const details = [];
        if (user.location) details.push(chalk.dim(`Location: ${user.location}`));
        if (user.url) details.push(chalk.dim(`URL: ${user.url}`));
        lines.push(details.join('  '));
      }

      if (user.created_at) {
        const joined = new Date(user.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        });
        lines.push(chalk.dim(`Joined ${joined}`));
      }

      console.log(
        boxen(lines.join('\n'), {
          padding: 1,
          borderColor: 'cyan',
          borderStyle: 'round',
        })
      );
    } catch (err) {
      spinner.fail('Failed to fetch profile');
      handleApiError(err);
      process.exitCode = 1;
    }
  });
