import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getClient } from '../lib/client.js';
import { successMessage, errorMessage, warnMessage } from '../lib/formatter.js';
import { handleApiError } from '../lib/errors.js';
import { validateTweetLength, validateThread, validateFile } from '../utils/validate.js';
import { uploadMedia, postSingleTweet, postThreadTweets, truncate } from '../lib/post-helper.js';
import {
  getScheduledTweets,
  addScheduledTweet,
  getScheduledTweet,
  updateScheduledTweet,
  removeScheduledTweet,
  getDueTweets,
  purgeOldEntries,
} from '../lib/schedule-store.js';
import { acquireLock, releaseLock } from '../lib/lock.js';

function parseScheduleDate(dateStr) {
  let normalized = dateStr.trim();
  // "2026-02-10 14:30" → "2026-02-10T14:30"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(' ', 'T');
  }
  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatRelativeTime(date) {
  const now = Date.now();
  const target = date.getTime();
  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const future = diffMs > 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  let relative;
  if (minutes < 1) relative = 'now';
  else if (minutes < 60) relative = `${minutes}m`;
  else if (hours < 24) relative = `${hours}h ${minutes % 60}m`;
  else relative = `${days}d ${hours % 24}h`;

  if (relative === 'now') return relative;
  return future ? `in ${relative}` : `${relative} ago`;
}

function formatLocalTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const LOG_DIR = join(homedir(), '.galah');
const LOG_FILE = join(LOG_DIR, 'schedule.log');
const MAX_LOG_BYTES = 1_048_576; // 1MB

function rotateLogIfNeeded() {
  try {
    if (!existsSync(LOG_FILE)) return;
    const stats = statSync(LOG_FILE);
    if (stats.size <= MAX_LOG_BYTES) return;

    const content = readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n');
    const trimmed = lines.slice(-500).join('\n');
    writeFileSync(LOG_FILE, trimmed);
  } catch {
    // Non-critical
  }
}

// --- ADD ---

const addCommand = new Command('add')
  .description('Schedule a tweet or thread for future posting')
  .argument('[text]', 'Tweet text')
  .option('--at <datetime>', 'When to post (e.g. "2026-02-10 14:30")')
  .option('--thread-file <path>', 'Schedule a thread from a JSON file')
  .option('--media <path>', 'Attach media to the first tweet')
  .action(async (text, options) => {
    try {
      if (!options.at) {
        errorMessage('--at is required. Example: galah schedule add "text" --at "2026-02-10 14:30"');
        process.exitCode = 1;
        return;
      }

      const scheduledAt = parseScheduleDate(options.at);
      if (!scheduledAt) {
        errorMessage('Invalid date format. Use: YYYY-MM-DD HH:mm');
        process.exitCode = 1;
        return;
      }

      if (scheduledAt <= new Date()) {
        errorMessage('Scheduled time must be in the future.');
        process.exitCode = 1;
        return;
      }

      let type, tweetText, threadData, threadFile;

      if (options.threadFile) {
        type = 'thread';
        const data = validateFile(options.threadFile);
        if (!Array.isArray(data)) {
          errorMessage('File must contain a JSON array of strings.');
          process.exitCode = 1;
          return;
        }
        validateThread(data);
        threadData = data;
        threadFile = resolve(options.threadFile);
      } else if (text) {
        type = 'tweet';
        validateTweetLength(text);
        tweetText = text;
      } else {
        errorMessage('Provide tweet text or --thread-file.');
        process.exitCode = 1;
        return;
      }

      let mediaPath = null;
      if (options.media) {
        mediaPath = resolve(options.media);
        if (!existsSync(mediaPath)) {
          errorMessage(`Media file not found: ${mediaPath}`);
          process.exitCode = 1;
          return;
        }
      }

      const entry = addScheduledTweet({
        type,
        text: tweetText,
        threadData,
        threadFile,
        mediaPath,
        scheduledAt: scheduledAt.toISOString(),
      });

      const preview = type === 'thread'
        ? `[thread: ${threadData.length} tweets]`
        : truncate(tweetText, 50);

      successMessage(`Scheduled #${entry.id}: ${preview}`);
      console.log(chalk.dim(`  Post at: ${formatLocalTime(entry.scheduledAt)} (${formatRelativeTime(scheduledAt)})`));
    } catch (error) {
      handleApiError(error);
      process.exitCode = 1;
    }
  });

// --- LIST ---

const listCommand = new Command('list')
  .description('Show scheduled tweets')
  .action(() => {
    const tweets = getScheduledTweets();

    if (tweets.length === 0) {
      warnMessage('No scheduled tweets.');
      return;
    }

    const sorted = [...tweets].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    const table = new Table({
      head: [
        chalk.bold('ID'),
        chalk.bold('Scheduled'),
        chalk.bold('Preview'),
        chalk.bold('Status'),
      ],
      colWidths: [6, 28, 44, 10],
      wordWrap: true,
    });

    for (const t of sorted) {
      const time = `${formatLocalTime(t.scheduledAt)}\n${chalk.dim(formatRelativeTime(new Date(t.scheduledAt)))}`;

      let preview;
      if (t.type === 'thread') {
        const count = t.threadData?.length ?? '?';
        const first = t.threadData?.[0] ? truncate(t.threadData[0], 30) : '';
        preview = `[thread: ${count}] ${first}`;
      } else {
        preview = truncate(t.text || '', 40);
      }

      const statusColors = {
        pending: chalk.yellow,
        posted: chalk.green,
        failed: chalk.red,
      };
      const status = (statusColors[t.status] || chalk.white)(t.status);

      table.push([`#${t.id}`, time, preview, status]);
    }

    console.log(table.toString());
  });

// --- CANCEL ---

const cancelCommand = new Command('cancel')
  .description('Cancel a scheduled tweet')
  .argument('<id>', 'Scheduled tweet ID')
  .action(async (idStr) => {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      errorMessage('ID must be a number.');
      process.exitCode = 1;
      return;
    }

    const entry = getScheduledTweet(id);
    if (!entry) {
      errorMessage(`No scheduled tweet with ID ${id}.`);
      process.exitCode = 1;
      return;
    }

    if (entry.status === 'posted') {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'This tweet was already posted. Remove from history?',
        default: false,
      }]);
      if (!proceed) return;
    }

    removeScheduledTweet(id);

    const preview = entry.type === 'thread'
      ? `[thread: ${entry.threadData?.length} tweets]`
      : truncate(entry.text || '', 50);

    successMessage(`Cancelled #${id}: ${preview}`);
  });

// --- RUN ---

const runCommand = new Command('run')
  .description('Post due scheduled tweets (called by cron)')
  .action(async () => {
    if (!acquireLock()) {
      console.log(`[${timestamp()}] [SKIP] Another schedule run is in progress`);
      return;
    }

    try {
      purgeOldEntries(7);
      rotateLogIfNeeded();

      const due = getDueTweets();

      if (due.length === 0) {
        console.log(`[${timestamp()}] [OK] No tweets due`);
        return;
      }

      let posted = 0;
      let failed = 0;

      for (const entry of due) {
        const preview = entry.type === 'thread'
          ? `[thread: ${entry.threadData?.length} tweets]`
          : truncate(entry.text || '', 40);

        console.log(`[${timestamp()}] [POST] #${entry.id}: ${preview}`);

        try {
          const { rwClient, client } = getClient();

          let mediaIds;
          if (entry.mediaPath) {
            if (!existsSync(entry.mediaPath)) {
              throw new Error(`Media file not found: ${entry.mediaPath}`);
            }
            mediaIds = await uploadMedia(client, entry.mediaPath, { silent: true });
          }

          if (entry.type === 'thread') {
            const result = await postThreadTweets(rwClient, entry.threadData, { mediaIds, silent: true });
            if (result.failedIndex !== null) {
              throw result.error || new Error(`Failed at tweet ${result.failedIndex + 1}`);
            }
            updateScheduledTweet(entry.id, { status: 'posted', tweetUrl: result.url });
            console.log(`[${timestamp()}] [OK] #${entry.id} posted: ${result.url}`);
          } else {
            const result = await postSingleTweet(rwClient, entry.text, { mediaIds, silent: true });
            updateScheduledTweet(entry.id, { status: 'posted', tweetUrl: result.url });
            console.log(`[${timestamp()}] [OK] #${entry.id} posted: ${result.url}`);
          }

          posted++;
        } catch (err) {
          updateScheduledTweet(entry.id, { status: 'failed', error: err.message });
          console.log(`[${timestamp()}] [FAIL] #${entry.id}: ${err.message}`);
          failed++;
        }
      }

      console.log(`[${timestamp()}] [DONE] ${posted} posted, ${failed} failed`);
    } finally {
      releaseLock();
    }
  });

// --- SETUP ---

const setupCommand = new Command('setup')
  .description('Install/remove the cron job for scheduled posting')
  .option('--remove', 'Remove the cron job')
  .action(async (options) => {
    try {
      execSync('which crontab', { stdio: 'ignore' });
    } catch {
      errorMessage('crontab not available on this system.');
      console.log(chalk.dim('Set up a scheduled task manually to run: galah schedule run'));
      process.exitCode = 1;
      return;
    }

    const galahPath = resolve(process.argv[1]);
    const cronLine = `* * * * * ${galahPath} schedule run >> ${LOG_FILE} 2>&1`;
    const cronMarker = 'galah schedule run';

    let existing = '';
    try {
      existing = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch {
      // No existing crontab
    }

    if (options.remove) {
      const lines = existing.split('\n');
      const filtered = lines.filter((l) => !l.includes(cronMarker));

      if (filtered.length === lines.length) {
        warnMessage('No galah cron entry found.');
        return;
      }

      console.log(chalk.dim('Removing cron entry:'));
      lines.filter((l) => l.includes(cronMarker)).forEach((l) => console.log(chalk.red(`  - ${l}`)));

      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Remove this cron entry?',
        default: true,
      }]);

      if (!proceed) return;

      const newCrontab = filtered.join('\n').replace(/\n{3,}/g, '\n\n');
      execSync(`echo ${JSON.stringify(newCrontab)} | crontab -`);
      successMessage('Cron entry removed.');
      return;
    }

    // Install
    if (existing.includes(cronMarker)) {
      warnMessage('Galah cron entry already exists:');
      existing.split('\n')
        .filter((l) => l.includes(cronMarker))
        .forEach((l) => console.log(chalk.dim(`  ${l}`)));

      const { replace } = await inquirer.prompt([{
        type: 'confirm',
        name: 'replace',
        message: 'Replace existing entry?',
        default: false,
      }]);

      if (!replace) return;

      const filtered = existing.split('\n').filter((l) => !l.includes(cronMarker)).join('\n');
      existing = filtered;
    }

    console.log(chalk.dim('\nThis will add the following cron entry:'));
    console.log(chalk.cyan(`  ${cronLine}`));
    console.log(chalk.dim('\nRuns every minute to check for scheduled tweets.\n'));

    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Add this cron entry?',
      default: true,
    }]);

    if (!proceed) return;

    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }

    const newCrontab = existing.trimEnd() + '\n' + cronLine + '\n';
    execSync(`echo ${JSON.stringify(newCrontab)} | crontab -`);
    successMessage('Cron entry added! Scheduled tweets will be posted automatically.');
    console.log(chalk.dim(`  Log file: ${LOG_FILE}`));
  });

// --- PARENT COMMAND ---

export const scheduleCommand = new Command('schedule')
  .description('Schedule tweets for future posting')
  .addCommand(addCommand)
  .addCommand(listCommand)
  .addCommand(cancelCommand)
  .addCommand(runCommand)
  .addCommand(setupCommand);
