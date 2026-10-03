# Publishing this MCP server

## Current state

Published to the official MCP Registry on 2026-10-02 as a **remote server**:

```
io.github.seotrader/speedcontent-social   v0.1.0   active
→ https://speedcontent.online/mcp
```

Check it:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.seotrader/speedcontent-social"
```

Free-text search ("speedcontent") lags behind the record for a while after publishing — query the exact name if you want an immediate answer.

## Why remote and not npm

The registry hosts metadata, not artifacts. A `packages` entry has to point at a real published npm or PyPI package, which means publishing one, keeping its version in step, and asking every user to install it. A `remotes` entry just points at a URL.

Since the API is already a hosted service, the remote route means:

- nothing for users to install
- tool changes reach everyone on the next deploy, with no upgrade step
- no npm account, no 2FA dance, no provenance attestation
- calls land on infrastructure where they can be metered

The npm route stays available if an important client only supports stdio — `remotes` and `packages` can coexist in one manifest.

## Releasing a new version

The server code lives in the API service (`mcp_server.py`), so a tool change ships with a normal Cloud Run deploy. The registry entry doesn't need touching.

Only re-publish here when the manifest itself changes — the URL, the declared headers, the description:

1. Bump `version` in `server.json`
2. `mcp-publisher login github`
3. `mcp-publisher validate && mcp-publisher publish`

## Where it gets listed

| Directory | How | Action |
| --- | --- | --- |
| **Official MCP Registry** | `mcp-publisher publish` | ✅ Done |
| **Glama** | Crawls the registry and GitHub, daily | Automatic |
| **PulseMCP** | Crawls the registry | Automatic |
| **mcp.directory** | Crawls the registry | Automatic |
| **Smithery** | smithery.ai dashboard or CLI | Manual, not done |
| **mcp.so** | Submit button, or their GitHub issues | Manual, not done |
| **awesome-mcp-servers** | Community GitHub list | A pull request, optional |

## If the stdio fallback ever goes to npm

The package name `speedcontent-social-mcp` was unregistered as of 2026-10-01, and `.github/workflows/publish.yml` already publishes with provenance off a version tag. You would need:

1. An npm **granular access token with "bypass 2FA" enabled** — an ordinary automation token is refused with a 403
2. That token as the `NPM_TOKEN` repo secret
3. The workflow registered as a Trusted Publisher on the npm package

Note the chicken-and-egg: npm won't accept a Trusted Publisher for a package that doesn't exist yet, so the very first publish has to be manual with an OTP.

Then add a `packages` entry to `server.json` alongside `remotes`, keeping `mcpName` in `package.json` identical to `name` in `server.json`.
