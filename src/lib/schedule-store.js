import Conf from 'conf';

const config = new Conf({ projectName: 'galah' });

const TWEETS_KEY = 'scheduledTweets';
const NEXT_ID_KEY = 'scheduledTweetNextId';

function getTweets() {
  return config.get(TWEETS_KEY, []);
}

function setTweets(tweets) {
  config.set(TWEETS_KEY, tweets);
}

function nextId() {
  const id = config.get(NEXT_ID_KEY, 1);
  config.set(NEXT_ID_KEY, id + 1);
  return id;
}

export function getScheduledTweets() {
  return getTweets();
}

export function addScheduledTweet({ type, text, threadData, threadFile, mediaPath, scheduledAt }) {
  const entry = {
    id: nextId(),
    type,
    text: text ?? null,
    threadData: threadData ?? null,
    threadFile: threadFile ?? null,
    mediaPath: mediaPath ?? null,
    scheduledAt,
    status: 'pending',
    tweetUrl: null,
    error: null,
    createdAt: new Date().toISOString(),
  };

  const tweets = getTweets();
  tweets.push(entry);
  setTweets(tweets);

  return entry;
}

export function getScheduledTweet(id) {
  return getTweets().find((t) => t.id === id) ?? null;
}

export function updateScheduledTweet(id, updates) {
  const tweets = getTweets();
  const index = tweets.findIndex((t) => t.id === id);

  if (index === -1) return false;

  tweets[index] = { ...tweets[index], ...updates, id };
  setTweets(tweets);
  return true;
}

export function removeScheduledTweet(id) {
  const tweets = getTweets();
  const filtered = tweets.filter((t) => t.id !== id);

  if (filtered.length === tweets.length) return false;

  setTweets(filtered);
  return true;
}

export function getDueTweets() {
  const now = new Date().toISOString();
  return getTweets().filter((t) => t.status === 'pending' && t.scheduledAt <= now);
}

export function purgeOldEntries(daysOld = 7) {
  const tweets = getTweets();
  const cutoff = new Date(Date.now() - daysOld * 86_400_000).toISOString();

  const kept = tweets.filter(
    (t) => t.status === 'pending' || t.createdAt > cutoff
  );

  const removed = tweets.length - kept.length;
  setTweets(kept);
  return removed;
}
