import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/client.js';
import { handleApiError } from '../lib/errors.js';
import { successMessage, errorMessage, warnMessage } from '../lib/formatter.js';

export const deleteCommand = new Command('delete')
  .description('Delete a tweet')
  .argument('<id>', 'Tweet ID to delete')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (id, options) => {
    if (!/^\d+$/.test(id)) {
      errorMessage('Invalid tweet ID. Provide a numeric ID.');
      process.exitCode = 1;
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete tweet ${chalk.bold(id)}?`,
          default: false,
        },
      ]);

      if (!confirm) {
        warnMessage('Cancelled.');
        return;
      }
    }

    const spinner = ora('Deleting tweet...').start();
    try {
      const { rwClient } = getClient();
      const result = await rwClient.v2.deleteTweet(id);

      if (result.data?.deleted) {
        spinner.succeed('Tweet deleted');
        successMessage(`Tweet ${id} deleted successfully.`);
      } else {
        spinner.fail('Delete unsuccessful');
        errorMessage('Could not delete tweet. It may not exist or you may not own it.');
        process.exitCode = 1;
      }
    } catch (error) {
      spinner.fail('Failed to delete tweet');
      handleApiError(error);
      process.exitCode = 1;
    }
  });
