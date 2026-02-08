import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getClient } from '../lib/client.js';
import { successMessage, errorMessage, warnMessage } from '../lib/formatter.js';
import { handleApiError } from '../lib/errors.js';
import { validateThread, validateFile } from '../utils/validate.js';
import { tweetUrl, truncate, uploadMedia, postThreadTweets } from '../lib/post-helper.js';

/**
 * Show a preview of the thread before posting.
 */
function showPreview(tweets) {
  console.log(chalk.bold(`\nThread preview (${tweets.length} tweets):\n`));

  const previewCount = Math.min(tweets.length, 3);
  for (let i = 0; i < previewCount; i++) {
    const num = chalk.bold.yellow(`[${i + 1}/${tweets.length}]`);
    console.log(`${num} ${tweets[i]}`);
    if (i < previewCount - 1) console.log(chalk.dim('  |'));
  }

  if (tweets.length > 3) {
    console.log(chalk.dim(`  ... and ${tweets.length - 3} more tweets`));
  }

  console.log();
}

/**
 * Build a thread interactively, prompting the user for each tweet.
 */
async function buildInteractiveThread() {
  const tweets = [];
  console.log(chalk.dim('Build your thread one tweet at a time. Enter an empty line to finish.\n'));

  while (true) {
    const { text } = await inquirer.prompt([
      {
        type: 'input',
        name: 'text',
        message: `Tweet ${tweets.length + 1}:`,
        validate: (input) => {
          if (input.trim().length === 0 && tweets.length === 0) {
            return 'Thread must contain at least one tweet.';
          }
          if (input.trim().length === 0) return true; // empty line = done
          if (input.length > 280) {
            return `Over by ${input.length - 280} characters (max 280).`;
          }
          return true;
        },
      },
    ]);

    if (text.trim().length === 0) break;

    tweets.push(text);
    console.log(chalk.dim(`  ${text.length}/280 characters`));

    if (tweets.length >= 25) {
      warnMessage('Maximum thread length reached (25 tweets).');
      break;
    }
  }

  return tweets;
}

export const threadCommand = new Command('thread')
  .description('Post a thread of tweets')
  .argument('[tweets...]', 'Tweet texts (each argument is one tweet)')
  .option('--file <path>', 'Read thread from a JSON file (array of strings)')
  .option('--interactive', 'Build thread interactively')
  .option('--dry-run', 'Validate thread without posting')
  .option('--no-confirm', 'Skip confirmation prompt')
  .option('--media <path>', 'Attach an image or video to the first tweet')
  .action(async (tweetArgs, options) => {
    try {
      let tweets;

      // Determine tweet source: --file, --interactive, or CLI args
      if (options.file) {
        const data = validateFile(options.file);
        if (!Array.isArray(data)) {
          errorMessage('File must contain a JSON array of strings.');
          process.exitCode = 1;
          return;
        }
        tweets = data;
      } else if (options.interactive) {
        tweets = await buildInteractiveThread();
        if (tweets.length === 0) {
          warnMessage('No tweets entered. Thread cancelled.');
          return;
        }
      } else if (tweetArgs && tweetArgs.length > 0) {
        tweets = tweetArgs;
      } else {
        // No source specified -- fall back to interactive
        tweets = await buildInteractiveThread();
        if (tweets.length === 0) {
          warnMessage('No tweets entered. Thread cancelled.');
          return;
        }
      }

      // Validate all tweets upfront
      validateThread(tweets);

      // Show preview
      showPreview(tweets);

      // Dry run stops here
      if (options.dryRun) {
        successMessage(`Dry run passed. Thread is valid (${tweets.length} tweets).`);
        return;
      }

      // Confirmation prompt
      if (options.confirm !== false) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Post this ${tweets.length}-tweet thread?`,
            default: true,
          },
        ]);

        if (!proceed) {
          warnMessage('Thread cancelled.');
          return;
        }
      }

      // Get authenticated client
      const { rwClient, client } = getClient();

      // Upload media if provided
      let mediaIds;
      if (options.media) {
        mediaIds = await uploadMedia(client, options.media);
      }

      // Post the thread sequentially
      const { posted, failedIndex, error } = await postThreadTweets(rwClient, tweets, { mediaIds });

      if (failedIndex !== null) {
        // Partial failure
        console.log();
        if (posted.length > 0) {
          warnMessage(`${posted.length}/${tweets.length} tweets posted before failure.`);
          successMessage(`Last successful tweet: ${tweetUrl(posted[posted.length - 1])}`);
          console.log(chalk.dim('You can continue the thread manually from this tweet.'));
        }
        console.log();
        errorMessage(`Failed on tweet ${failedIndex + 1}: "${truncate(tweets[failedIndex], 60)}"`);
        handleApiError(error);
        process.exitCode = 1;
        return;
      }

      // Full success
      console.log();
      successMessage(`Thread: ${tweetUrl(posted[0])}`);
    } catch (error) {
      handleApiError(error);
      process.exitCode = 1;
    }
  });
