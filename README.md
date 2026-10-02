# SpeedContent Social MCP

Give an AI agent the ability to write social media posts that don't read like AI wrote them.

An MCP server for the [SpeedContent](https://speedcontent.online) Social Post API. Agents can draft posts for seven platforms; each one is written to that platform's conventions, rewritten to read as human-authored, scored against AI detection, and optionally illustrated.

## Why this and not a plain model call

Any model can write a LinkedIn post. The difference here is what happens after:

| Step | What it does |
| --- | --- |
| Generate | Written against the platform's own style guide, not one prompt reskinned |
| Humanize | Rewritten so it doesn't read as machine-written |
| Detect | Scored 0–65 by an AI detector; 0 reads as human |
| Emoji | Platform-aware; suppressed on LinkedIn and YouTube |
| Re-humanize | Automatic retry if the score comes back too high |
| Image | Optional, generated to match the post |

The scoring pass is the point. The agent gets told how human the copy reads *before* anything is published.

## Setup

Get an API key at [app.speedcontent.online/APIKeys](https://app.speedcontent.online/APIKeys) — free credits on signup, no card.

### Claude Code

```bash
claude mcp add speedcontent-social \
  --env SPEEDCONTENT_API_KEY=sc_your_key_here \
  -- npx -y speedcontent-social-mcp
```

### Claude Desktop, Cursor, and other clients

Add to your MCP config:

```json
{
  "mcpServers": {
    "speedcontent-social": {
      "command": "npx",
      "args": ["-y", "speedcontent-social-mcp"],
      "env": {
        "SPEEDCONTENT_API_KEY": "sc_your_key_here"
      }
    }
  }
}
```

## Tools

### `generate_social_post`

Writes the post and waits for it. Takes 20–90 seconds and costs credits.

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

Looks up a job by id. Only needed if a generation outlived the tool timeout. Free.

### `list_social_platforms`

Lists platforms with default lengths and emoji policy. Free, no network call.

## Credits

Per post: 20 base (up to 200 words), +1 per 10 words beyond 200, +10 for an image, +8 for AI detection. Multiplied by `quantity`. Credits are refunded in full if generation fails.

A 100-word LinkedIn post with an image costs 30 credits.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPEEDCONTENT_API_KEY` | Yes | Your key from the dashboard. |
| `SPEEDCONTENT_BASE_URL` | No | Override the API host. Defaults to production. |

## Reselling

Volume and white-label pricing is per post rather than per seat, and your users don't need SpeedContent accounts of their own. [Get in touch](https://speedcontent.online).

## Licence

MIT
