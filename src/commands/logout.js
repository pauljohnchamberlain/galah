import { Command } from 'commander';
import inquirer from 'inquirer';
import { getCredentials, clearCredentials } from '../lib/config.js';
import { successMessage, warnMessage } from '../lib/formatter.js';

export const logoutCommand = new Command('logout')
  .description('Clear stored credentials')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options) => {
    const creds = getCredentials();

    if (!creds || !creds.apiKey) {
      warnMessage('No stored credentials found. Nothing to clear.');
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to clear your stored credentials?',
          default: false,
        },
      ]);

      if (!confirm) {
        warnMessage('Cancelled.');
        return;
      }
    }

    clearCredentials();
    successMessage('Credentials cleared. Run `galah auth` to re-authenticate.');
  });
