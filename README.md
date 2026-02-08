# galah

A chatty Twitter/X CLI that won't get you banned.

**galah** (the pink cockatoo, Australia's chattiest bird) is a command-line client for Twitter/X built on the official API v2. Unlike tools that scrape or use undocumented GraphQL endpoints, galah uses only sanctioned API calls -- so your account stays safe.

## Quick Start

```bash
npm install -g galah-cli
galah auth
galah post "Hello from the terminal!"
```

## Commands

### `galah auth`

Set up your Twitter API credentials. Supports OAuth PIN-based flow (recommended) or direct API key entry.

```bash
galah auth                # Interactive setup (choose OAuth or manual)
galah auth --api-key      # Skip straight to manual key entry
galah auth --status       # Check if your credentials are valid
```

You need a [Twitter Developer account](https://developer.twitter.com) with API keys. galah stores credentials locally via the system config directory (`~/.config/galah/` on Linux/macOS).

You can also set credentials via environment variables (these take precedence over stored credentials):

| Variable | Description |
|----------|-------------|
| `TWITTER_API_KEY` | Consumer API key |
| `TWITTER_API_SECRET` | Consumer API secret |
| `TWITTER_ACCESS_TOKEN` | User access token |
| `TWITTER_ACCESS_SECRET` | User access token secret |

### `galah post`

Post a single tweet. Provide text as an argument or enter it interactively.

```bash
galah post "Just shipped a new feature"
galah post                # Interactive prompt
galah post --dry-run "Test tweet"   # Validate without posting
```

### `galah thread`

Post a multi-tweet thread. This is galah's standout feature -- threads are posted sequentially via the API with proper `in_reply_to` chaining and built-in rate limit pacing.

```bash
# From CLI arguments (each argument is one tweet)
galah thread "First tweet" "Second tweet" "Third tweet"

# From a JSON file
galah thread --file thread.json

# Build interactively
galah thread --interactive

# Validate without posting
galah thread --file thread.json --dry-run

# Skip the confirmation prompt
galah thread --file thread.json --no-confirm
```

Thread file format (`thread.json`):

```json
[
  "First tweet in the thread",
  "Second tweet continues the story",
  "Final tweet wraps it up"
]
```

If a thread partially fails (e.g., rate limit hit mid-thread), galah tells you exactly which tweets were posted and gives you the URL of the last successful tweet so you can continue manually.

### `galah timeline`

View your home timeline or mentions.

```bash
galah timeline               # Home timeline (20 tweets)
galah timeline --limit 50    # Show more tweets
galah timeline --mentions    # View mentions instead
```

### `galah view`

View a specific tweet by ID or URL. If the tweet is part of a thread, galah fetches the thread context automatically.

```bash
galah view 1234567890
galah view https://twitter.com/user/status/1234567890
galah view https://x.com/user/status/1234567890
```

### `galah search`

Search for tweets.

```bash
galah search "typescript tips"
galah search "#buildinpublic" --limit 20
```

### `galah delete`

Delete one of your tweets.

```bash
galah delete 1234567890
galah delete 1234567890 --force   # Skip confirmation
```

### `galah me`

View your profile info -- follower count, bio, join date, and more.

```bash
galah me
```

### `galah logout`

Clear stored credentials from your machine.

```bash
galah logout
galah logout --force   # Skip confirmation
```

## Rate Limits

Twitter API v2 enforces rate limits based on your access tier:

| Tier | Tweet creation | Window |
|------|---------------|--------|
| Free | 50 tweets | per 24 hours |
| Basic | 100 tweets | per 24 hours |
| Pro | 300 tweets | per 3 hours |

galah monitors rate limit headers after each API call and warns you when you're running low. Thread posting includes a 500ms delay between tweets to avoid hitting limits.

## Why galah?

**Bird CLI** and similar tools use Twitter's internal GraphQL API -- the same endpoints the web app uses. Twitter actively detects and bans accounts that use these undocumented APIs for posting. Your account can be suspended without warning.

**galah** uses only the official Twitter API v2, which is the sanctioned way to interact with the platform programmatically. You need API keys (free tier available), but your account won't get flagged.

| | galah | Bird CLI |
|--|-------|----------|
| API | Official v2 (safe) | Internal GraphQL (risky) |
| Posting | Yes | Yes (may get you banned) |
| Auth | API keys / OAuth | Browser cookies |
| Account risk | None | Suspension possible |

## License

MIT
