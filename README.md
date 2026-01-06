# MCP Docs Scraper

An MCP (Model Context Protocol) server that gives coding agents fast, efficient access to software library documentation.

## Features

- 🚀 **GitHub-first** - Pulls docs directly from repos when possible (cleaner, faster)
- 🌐 **Smart scraping fallback** - Crawls and cleans docs sites when no repo is available
- 🔍 **Full-text search** - Search within fetched documentation
- 💾 **Stateful caching** - No duplicate fetches; instant re-reads
- 🌳 **Tree navigation** - Browse doc structure before fetching content

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run (stdio transport)
pnpm start
```

## MCP Configuration

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "node",
      "args": ["path/to/mcp-docs-scraper/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "node",
      "args": ["path/to/mcp-docs-scraper/dist/index.js"]
    }
  }
}
```

## Available Tools

| Tool                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `index_docs`         | Fetch and cache documentation from GitHub or web |
| `get_docs_tree`      | Get hierarchical structure of cached docs        |
| `get_docs_content`   | Retrieve content of specific doc files           |
| `search_docs`        | Full-text search within cached docs              |
| `detect_github_repo` | Find GitHub repo from a docs website URL         |
| `list_cached_docs`   | List all cached documentation                    |
| `clear_cache`        | Remove cached documentation                      |

## Example Usage

```
Agent: "I need to understand Zod's custom validation"

1. detect_github_repo({ url: "https://zod.dev" })
   → { found: true, repo: "colinhacks/zod" }

2. index_docs({ url: "https://github.com/colinhacks/zod" })
   → { id: "colinhacks_zod", tree: [...], stats: { pages: 45 } }

3. search_docs({ docs_id: "colinhacks_zod", query: "custom validation" })
   → [{ path: "README.md", snippet: "...custom validators..." }]

4. get_docs_content({ docs_id: "colinhacks_zod", paths: ["README.md"] })
   → { contents: { "README.md": { content: "..." } } }
```

## Development

See [plan/README.md](./plan/README.md) for development documentation and implementation plan.

## License

MIT
