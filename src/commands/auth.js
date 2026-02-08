import { Command } from 'commander';
import { TwitterApi } from 'twitter-api-v2';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../lib/client.js';
import { getCredentials, setCredentials, getConfigPath } from '../lib/config.js';
import { handleApiError } from '../lib/errors.js';
import { successMessage, errorMessage } from '../lib/formatter.js';

/**
 * Verify that stored credentials work by calling the Twitter API.
 * Returns the authenticated user data on success.
 */
async function verifyCredentials() {
  const { roClient } = getClient();
  const { data } = await roClient.v2.me({
    'user.fields': ['username', 'name', 'public_metrics', 'profile_image_url'],
  });
  return data;
}

/**
 * Prompt the user for all four API keys manually.
 */
async function promptForApiKeys() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (Consumer Key):',
      validate: (v) => (v.trim() ? true : 'API Key is required'),
    },
    {
      type: 'password',
      name: 'apiSecret',
      message: 'API Secret (Consumer Secret):',
      mask: '*',
      validate: (v) => (v.trim() ? true : 'API Secret is required'),
    },
    {
      type: 'input',
      name: 'accessToken',
      message: 'Access Token:',
      validate: (v) => (v.trim() ? true : 'Access Token is required'),
    },
    {
      type: 'password',
      name: 'accessSecret',
      message: 'Access Token Secret:',
      mask: '*',
      validate: (v) => (v.trim() ? true : 'Access Token Secret is required'),
    },
  ]);

  return {
    apiKey: answers.apiKey.trim(),
    apiSecret: answers.apiSecret.trim(),
    accessToken: answers.accessToken.trim(),
    accessSecret: answers.accessSecret.trim(),
  };
}

/**
 * Guide the user through PIN-based OAuth 1.0a flow.
 */
async function oauthFlow() {
  const appKeys = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (Consumer Key):',
      validate: (v) => (v.trim() ? true : 'API Key is required'),
    },
    {
      type: 'password',
      name: 'apiSecret',
      message: 'API Secret (Consumer Secret):',
      mask: '*',
      validate: (v) => (v.trim() ? true : 'API Secret is required'),
    },
  ]);

  const apiKey = appKeys.apiKey.trim();
  const apiSecret = appKeys.apiSecret.trim();

  const spinner = ora('Generating authorization link...').start();

  let authLink;
  try {
    const requestClient = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });
    authLink = await requestClient.generateAuthLink('oob', {
      linkMode: 'authorize',
    });
    spinner.succeed('Authorization link ready');
  } catch (err) {
    spinner.fail('Failed to generate authorization link');
    handleApiError(err);
    return null;
  }

  console.log();
  console.log(
    boxen(
      [
        chalk.bold('Open this URL in your browser:'),
        '',
        chalk.cyan.underline(authLink.url),
        '',
        chalk.dim('Sign in and authorize the app, then copy the PIN.'),
      ].join('\n'),
      { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
    )
  );
  console.log();

  const { pin } = await inquirer.prompt([
    {
      type: 'input',
      name: 'pin',
      message: 'Enter the PIN from Twitter:',
      validate: (v) => (v.trim() ? true : 'PIN is required'),
    },
  ]);

  const loginSpinner = ora('Verifying PIN...').start();

  try {
    const loginClient = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: authLink.oauth_token,
      accessSecret: authLink.oauth_token_secret,
    });

    const { accessToken, accessSecret } = await loginClient.login(pin.trim());

    loginSpinner.succeed('PIN verified');

    return { apiKey, apiSecret, accessToken, accessSecret };
  } catch (err) {
    loginSpinner.fail('PIN verification failed');
    handleApiError(err);
    return null;
  }
}

/**
 * Show current authentication status.
 */
async function showStatus() {
  const creds = getCredentials();

  if (!creds || !creds.apiKey) {
    console.log(
      boxen(
        [
          chalk.bold('Authentication Status'),
          '',
          chalk.red('Not authenticated'),
          '',
          chalk.dim('Run `galah auth` to set up your credentials.'),
        ].join('\n'),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      )
    );
    return;
  }

  const spinner = ora('Checking credentials...').start();

  try {
    const user = await verifyCredentials();
    spinner.succeed('Credentials valid');

    console.log(
      boxen(
        [
          chalk.bold('Authentication Status'),
          '',
          `${chalk.green('Authenticated')} as ${chalk.bold(`@${user.username}`)}`,
          '',
          chalk.dim(`Config: ${getConfigPath()}`),
        ].join('\n'),
        { padding: 1, borderColor: 'green', borderStyle: 'round' }
      )
    );
  } catch (err) {
    spinner.fail('Credentials invalid or expired');
    handleApiError(err);
  }
}

export const authCommand = new Command('auth')
  .description('Authenticate with Twitter/X API')
  .option('--api-key', 'Skip to API key setup directly')
  .option('--status', 'Show current authentication status')
  .action(async (options) => {
    try {
      // --status flag
      if (options.status) {
        await showStatus();
        return;
      }

      // Welcome header
      console.log(
        boxen(
          [
            chalk.bold.cyan('galah') + chalk.dim(' - Twitter/X CLI'),
            '',
            chalk.bold('Authentication Setup'),
            chalk.dim(
              'You need a Twitter/X Developer account with API keys.'
            ),
            chalk.dim('Get yours at https://developer.twitter.com'),
          ].join('\n'),
          { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
        )
      );
      console.log();

      let creds;

      if (options.apiKey) {
        // Direct API key entry
        creds = await promptForApiKeys();
      } else {
        // Choose method
        const { method } = await inquirer.prompt([
          {
            type: 'list',
            name: 'method',
            message: 'Choose authentication method:',
            choices: [
              {
                name: 'OAuth PIN-based (recommended)',
                value: 'oauth',
              },
              {
                name: 'Enter API keys manually',
                value: 'apikey',
              },
            ],
          },
        ]);

        if (method === 'oauth') {
          creds = await oauthFlow();
        } else {
          creds = await promptForApiKeys();
        }
      }

      if (!creds) {
        errorMessage('Authentication cancelled or failed.');
        process.exitCode = 1;
        return;
      }

      // Store credentials
      setCredentials(creds);

      // Verify they work
      const spinner = ora('Verifying credentials...').start();

      try {
        const user = await verifyCredentials();
        spinner.succeed('Credentials verified');
        console.log();
        successMessage(
          `Authenticated as ${chalk.bold(`@${user.username}`)} (${user.name})`
        );
      } catch (err) {
        spinner.fail('Credential verification failed');
        handleApiError(err);
        errorMessage(
          'Credentials were saved but could not be verified. You can retry with `galah auth`.'
        );
        process.exitCode = 1;
      }
    } catch (err) {
      handleApiError(err);
      process.exitCode = 1;
    }
  });
