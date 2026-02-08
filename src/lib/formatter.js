import chalk from 'chalk';
import timeAgo from 'time-ago';
const { ago } = timeAgo;

/**
 * Format a tweet for terminal display.
 * Highlights @mentions in cyan, #hashtags in blue, URLs underlined.
 */
export function formatTweet(tweet) {
  const author = tweet.author_id || tweet.user?.screen_name || 'unknown';
  const name = tweet.user?.name || tweet.name || author;
  const text = tweet.text || '';
  const createdAt = tweet.created_at ? new Date(tweet.created_at) : null;

  const lines = [];

  // Author line
  lines.push(`${chalk.bold(name)} ${chalk.dim(`@${author}`)}`);

  // Formatted tweet text
  lines.push(highlightText(text));

  // Timestamp and engagement
  const meta = [];
  if (createdAt) {
    meta.push(chalk.dim(formatTimestamp(createdAt)));
  }
  if (tweet.public_metrics) {
    const m = tweet.public_metrics;
    if (m.like_count > 0) meta.push(chalk.red(`${m.like_count} likes`));
    if (m.retweet_count > 0) meta.push(chalk.green(`${m.retweet_count} RTs`));
    if (m.reply_count > 0) meta.push(chalk.cyan(`${m.reply_count} replies`));
  }
  if (meta.length > 0) {
    lines.push(meta.join(chalk.dim(' | ')));
  }

  // Tweet ID
  if (tweet.id) {
    lines.push(chalk.dim(`ID: ${tweet.id}`));
  }

  return lines.join('\n');
}

/**
 * Highlight mentions, hashtags, and URLs in text.
 */
function highlightText(text) {
  return text
    .replace(/@(\w+)/g, chalk.cyan('@$1'))
    .replace(/#(\w+)/g, chalk.blue('#$1'))
    .replace(/(https?:\/\/\S+)/g, chalk.underline('$1'));
}

/**
 * Format a date as relative time ("2 hours ago").
 */
export function formatTimestamp(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return ago(date);
}

/**
 * Format an array of tweets as a numbered thread.
 */
export function formatThread(tweets) {
  if (!tweets || tweets.length === 0) return 'Empty thread';

  const lines = [];
  const separator = chalk.dim('---');

  tweets.forEach((tweet, i) => {
    lines.push(chalk.bold.yellow(`[${i + 1}/${tweets.length}]`));
    lines.push(formatTweet(tweet));
    if (i < tweets.length - 1) {
      lines.push(separator);
    }
  });

  return lines.join('\n');
}

/**
 * Display a success message.
 */
export function successMessage(msg) {
  console.log(chalk.green(`${msg}`));
}

/**
 * Display an error message.
 */
export function errorMessage(msg) {
  console.error(chalk.red(`${msg}`));
}

/**
 * Display a warning message.
 */
export function warnMessage(msg) {
  console.warn(chalk.yellow(`${msg}`));
}
