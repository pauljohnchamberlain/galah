import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getClient } from '../lib/client.js';
import { successMessage } from '../lib/formatter.js';
import { handleApiError } from '../lib/errors.js';
import { validateTweetLength } from '../utils/validate.js';
import { uploadMedia, postSingleTweet } from '../lib/post-helper.js';

export const postCommand = new Command('post')
  .description('Post a tweet')
  .argument('[text]', 'Tweet text')
  .option('--dry-run', 'Validate without posting')
  .option('--media <path>', 'Attach an image or video')
  .action(async (text, options) => {
    try {
      // Interactive mode if no text provided
      if (!text) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'text',
            message: 'What\'s happening?',
            validate: (input) => {
              if (!input || input.trim().length === 0) return 'Tweet text cannot be empty.';
              if (input.length > 280) return `Over by ${input.length - 280} characters (max 280).`;
              return true;
            },
          },
        ]);
        text = answers.text;
      }

      // Validate length
      validateTweetLength(text);

      // Show character count
      const remaining = 280 - text.length;
      console.log(chalk.dim(`${text.length}/280 characters (${remaining} remaining)`));

      // Dry run stops here
      if (options.dryRun) {
        successMessage('Dry run passed. Tweet is valid.');
        return;
      }

      const { rwClient, client } = getClient();

      let mediaIds;
      if (options.media) {
        mediaIds = await uploadMedia(client, options.media);
      }

      const result = await postSingleTweet(rwClient, text, { mediaIds });
      successMessage(result.url);
    } catch (error) {
      handleApiError(error);
      process.exitCode = 1;
    }
  });
