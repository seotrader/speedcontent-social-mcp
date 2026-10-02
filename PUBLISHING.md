# Publishing this MCP server

Verified against the live registry docs on 2026-10-01.

The short version: **publish once to npm and the official MCP Registry.** Glama, PulseMCP and mcp.directory crawl that registry, so one publish lands you in four places. Only Smithery and mcp.so need separate submissions.

## One-time setup

These need accounts and can't be automated away.

1. **Create the GitHub repo.** The manifest expects `github.com/seotrader/speedcontent-social-mcp`. Either create it under that name, or change `repository.url` in `server.json` and `package.json` to match wherever it lives.

2. **npm account.** `npm login`. The package name `speedcontent-social-mcp` was free as of 2026-10-01.

3. **Make the workflow a Trusted Publisher.** On npmjs.com → the package → Settings → Publish access → Trusted Publishers → add repository owner `seotrader`, repository `speedcontent-social-mcp`, workflow `publish.yml`.

   This is what produces the provenance attestation. It also matters beyond npm: since **1 May 2026** n8n refuses community nodes published from a local machine, so if you later ship an n8n node the same setup applies.

4. **`NPM_TOKEN` secret.** GitHub repo → Settings → Secrets → Actions → add an npm automation token.

## Publishing

With the above done, a release is one command:

```bash
git tag v0.1.0 && git push --tags
```

`.github/workflows/publish.yml` then builds, publishes to npm with provenance, and registers with the MCP Registry over GitHub OIDC.

### Doing it by hand instead

```bash
npm run build
npm publish --access public

# one-off: install the registry CLI
brew install mcp-publisher          # or the release tarball

mcp-publisher login github
mcp-publisher publish
```

Verify it landed:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.seotrader/speedcontent-social"
```

Note `mcpName` in `package.json` must stay identical to `name` in `server.json`, and with GitHub auth both must start with `io.github.seotrader/`. A mismatch is the most common publish rejection.

## Where it ends up

| Directory | How it gets listed | Action needed |
| --- | --- | --- |
| **Official MCP Registry** | `mcp-publisher publish` | The one publish above |
| **Glama** | Auto-indexes from the registry and GitHub, daily | None |
| **PulseMCP** | Crawls the registry | None |
| **mcp.directory** | Crawls the registry | None |
| **Smithery** | Submit at smithery.ai, via dashboard or CLI | One manual submission |
| **mcp.so** | Submit button on the site, or their GitHub issues | One manual submission |
| **awesome-mcp-servers** | Community GitHub list | A pull request, optional |

So: one publish, then two short forms.

## Version bumps

Three places have to move together, or the registry rejects the publish:

- `package.json` → `version`
- `server.json` → `version`
- `server.json` → `packages[0].version`

Then tag and push.
