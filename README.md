# SpeedContent Social MCP

Give an AI agent the ability to write social media posts that don't read like AI wrote them.

An MCP server for the [SpeedContent](https://speedcontent.online) Social Post API. Agents can draft posts for seven platforms; each one is written to that platform's conventions, rewritten to read as human-authored, scored against AI detection, and optionally illustrated.

Listed in the official MCP Registry as `io.github.seotrader/speedcontent-social`.

## Why this and not a plain model call

Any model can write a LinkedIn post. The difference is what happens after:

| Step | What it does |
| --- | --- |
| Generate | Written against the platform's own style guide, not one prompt reskinned |
| Humanize | Rewritten so it doesn't read as machine-written |
| Detect | Scored 0–65 by an AI detector; 0 reads as human |
| Emoji | Platform-aware; suppressed on LinkedIn and YouTube |
| Re-humanize | Automatic retry if the score comes back too high |
| Image | Optional, generated to match the post |

The scoring pass is the point. The agent is told how human the copy reads *before* anything is published.

## Setup

This is a **remote** server — there is nothing to install. Get an API key at [app.speedcontent.online/APIKeys](https://app.speedcontent.online/APIKeys) (free credits on signup, no card), then point your client at the URL.

### Claude Code

```bash
claude mcp add --transport http speedcontent-social \
  https://generatecontentwithaiservice-g5zrtckfda-ue.a.run.app/mcp \
  --header "X-API-Key: sc_your_key_here"
```

### Claude Desktop, Cursor, and other clients

```json
{
  "mcpServers": {
    "speedcontent-social": {
      "url": "https://generatecontentwithaiservice-g5zrtckfda-ue.a.run.app/mcp",
      "headers": {
        "X-API-Key": "sc_your_key_here"
      }
    }
  }
}
```

`Authorization: Bearer sc_...` works too, for clients that prefer it.

## Tools

### `generate_social_post`

Starts a job and returns its id. Generation takes 20–90 seconds; collect the result with `check_social_job`. Costs credits.

| Parameter | Default | Notes |
| --- | --- | --- |
| `topic` | — | Required. What the post is about. |
| `platform` | — | Required. `facebook`, `instagram`, `twitter`, `linkedin`, `pinterest`, `youtube`, `tiktok`. |
| `tone` | `friendly` | `professional`, `casual`, `friendly`, `humorous`, `inspirational`, `educational`. |
| `language` | `English` | Any language name. |
| `quantity` | `1` | Up to 10 variations. |
| `word_count` | per platform | 10–500. LinkedIn 100, YouTube 150, Facebook/Pinterest 75, Instagram/TikTok 50, X 40. |
| `generate_image` | `true` | Adds 10 credits per post. |
| `detect_ai` | automatic | Adds 8 credits per post. Automatic means 150+ words only — short posts score unreliably. |
| `brand_name`, `brand_description`, `brand_tone`, `brand_audience`, `brand_keywords` | — | Optional brand voice. |

### `check_social_job`

Returns the finished posts, or current progress while the job runs. Free.

### `list_social_platforms`

Platforms with default lengths and emoji policy. Free, no network call.

## Credits

Per post: 20 base (up to 200 words), +1 per 10 words beyond 200, +10 for an image, +8 for AI detection. Multiplied by `quantity`. Refunded in full if generation fails.

A 100-word LinkedIn post with an image costs 30 credits.

## What's in this repo

The live server runs inside the SpeedContent API service. This repo holds the registry manifest and a standalone stdio implementation.

| Path | What it is |
| --- | --- |
| `server.json` | The MCP Registry manifest, pointing at the hosted endpoint |
| `src/index.ts` | A standalone stdio server, for clients that can't do remote HTTP |
| `PUBLISHING.md` | How this gets published and listed |

The stdio build is not on npm and isn't needed for normal use. It exists as a fallback for older MCP clients that only support subprocess transport:

```bash
npm install && npm run build
SPEEDCONTENT_API_KEY=sc_... node dist/index.js
```

## Reselling

Volume and white-label pricing is per post rather than per seat, and your users don't need SpeedContent accounts of their own. [Get in touch](https://speedcontent.online).

## Licence

MIT
