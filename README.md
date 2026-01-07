# MCP Docs Scraper

**Give your AI coding agent instant, structured access to any library's documentation.**

[![npm version](https://img.shields.io/npm/v/mcp-docs-scraper.svg)](https://www.npmjs.com/package/mcp-docs-scraper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22+](https://img.shields.io/badge/node-22%2B-brightgreen.svg)](https://nodejs.org/)

## The Problem

When your agent needs documentation, it typically:

1. **Searches the web** → Gets 10 links, picks one
2. **Fetches the page** → Downloads HTML, parses it
3. **Realizes it needs more** → Goes back, fetches another page
4. **Repeats 3-5 times** → Each step is a tool call

That's **5-15 tool calls** just to answer "how do I validate emails with Zod?" Each call adds latency and burns tokens on navigation overhead.

## The Solution

MCP Docs Scraper **indexes documentation once** and gives your agent **direct, structured access**:

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│  GitHub Repo    │─────▶│  MCP Docs        │─────▶│  AI Agent   │
│  or Docs Site   │      │  Scraper         │      │             │
└─────────────────┘      │  ┌────────────┐  │      │  1 search   │
                         │  │ Local      │  │      │  1 fetch    │
                         │  │ Cache      │  │      │  Done.      │
                         │  └────────────┘  │      └─────────────┘
                         └──────────────────┘
```

**Result:** 2 tool calls instead of 10. Faster responses, lower costs, better answers.

## Quick Start

**1. Add to your MCP config:**

For **Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "npx",
      "args": ["-y", "mcp-docs-scraper"]
    }
  }
}
```

For **Cursor** (`.cursor/mcp.json` in your project or global config):

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "npx",
      "args": ["-y", "mcp-docs-scraper"]
    }
  }
}
```

**2. Restart your AI client**

**3. Ask your agent something like:**

> "Index the Zod documentation and show me how to create custom validators"

The agent will automatically use the tools to index, search, and retrieve exactly what it needs.

## Features

| Feature                         | Why It Matters                                                 |
| ------------------------------- | -------------------------------------------------------------- |
| **GitHub-first fetching**       | Pulls clean markdown directly from repos—no HTML parsing noise |
| **Smart web scraping fallback** | Works even when there's no GitHub repo available               |
| **Auto-detection**              | Point it at `zod.dev`, it finds the GitHub repo automatically  |
| **Full-text search**            | Agent finds the right section in one call, not five            |
| **Local caching**               | Index once, use forever. Works offline after first fetch       |
| **Structured tree navigation**  | Agent sees what's available without loading everything         |

## Available Tools

| Tool                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `index_docs`         | Fetch and cache documentation from GitHub or any website |
| `get_docs_tree`      | Browse the structure of cached docs                      |
| `search_docs`        | Full-text search with snippets                           |
| `get_docs_content`   | Retrieve specific files from cache                       |
| `detect_github_repo` | Find GitHub repo from a docs website URL                 |
| `list_cached_docs`   | List all cached documentation                            |
| `clear_cache`        | Remove cached documentation                              |

## How Agents Use This

Here's a typical interaction when you ask "How do I use Zod's transform feature?":

```
Agent: [Calls search_docs for "colinhacks_zod" with query "transform"]
       → Gets: [{path: "README.md", snippet: "...transform method allows..."}]

Agent: [Calls get_docs_content for "README.md"]
       → Gets: Full markdown content of that section

Agent: "Here's how to use Zod's transform feature: ..."
```

**2 tool calls. Done.** Compare that to the web search → browse → scroll → click → read → go back loop.

### First-Time Indexing

If docs aren't cached yet, the agent indexes them first:

```
Agent: [Calls index_docs for "https://github.com/colinhacks/zod"]
       → Fetches all markdown files, caches locally
       → Returns: {id: "colinhacks_zod", pages: 15, ...}
```

This happens once. After that, all access is instant from local cache.

## Tool Details

### `index_docs`

Fetch and cache documentation from a GitHub repository or website.

```typescript
// Index from GitHub (recommended)
index_docs({ url: "https://github.com/colinhacks/zod" });

// Index from a docs site (auto-detects GitHub if possible)
index_docs({ url: "https://zod.dev" });

// Force web scraping when GitHub isn't available
index_docs({ url: "https://docs.example.com", type: "scrape" });

// Re-index to get latest changes
index_docs({ url: "https://github.com/owner/repo", force_refresh: true });
```

**Returns:**

```json
{
  "id": "colinhacks_zod",
  "source": "github",
  "repo": "colinhacks/zod",
  "stats": { "pages": 15, "total_size_bytes": 245000 }
}
```

### `search_docs`

Full-text search within cached documentation.

```typescript
search_docs({
  docs_id: "colinhacks_zod",
  query: "custom validation",
  limit: 10,
});
```

**Returns:**

```json
{
  "results": [
    {
      "path": "README.md",
      "title": "Zod",
      "snippet": "...you can create custom validators using...",
      "score": 12.5
    }
  ]
}
```

### `get_docs_content`

Retrieve actual content of specific files.

```typescript
get_docs_content({
  docs_id: "colinhacks_zod",
  paths: ["README.md", "docs/guide.md"],
});
```

**Returns:**

```json
{
  "contents": {
    "README.md": {
      "content": "# Zod\n\nTypeScript-first schema validation...",
      "headings": ["# Zod", "## Installation", "## Basic Usage"],
      "size_bytes": 15234
    }
  },
  "not_found": []
}
```

### `get_docs_tree`

Get the file structure of cached documentation.

```typescript
// Full tree
get_docs_tree({ docs_id: "colinhacks_zod" });

// Subtree only
get_docs_tree({ docs_id: "colinhacks_zod", path: "docs/", max_depth: 2 });
```

### `detect_github_repo`

Find GitHub repository from a documentation website URL.

```typescript
detect_github_repo({ url: "https://zod.dev" });
```

**Returns:**

```json
{
  "found": true,
  "repo": "colinhacks/zod",
  "confidence": "high",
  "detection_method": "github_links"
}
```

### `list_cached_docs` / `clear_cache`

```typescript
// See what's cached
list_cached_docs();

// Clear specific docs
clear_cache({ docs_id: "colinhacks_zod" });

// Clear everything
clear_cache({ all: true });
```

## Configuration

### With GitHub Token (Recommended for Heavy Use)

The GitHub API allows 60 requests/hour without authentication. For higher limits (5,000/hour), add a token:

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "npx",
      "args": ["-y", "mcp-docs-scraper"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Local Installation

If you prefer to install locally instead of using npx:

```bash
git clone https://github.com/kwiscion/mcp-docs-scraper.git
cd mcp-docs-scraper
pnpm install
pnpm build
```

Then configure:

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-docs-scraper/dist/index.js"]
    }
  }
}
```

## Cache Location

Documentation is cached locally:

- **macOS/Linux:** `~/.mcp-docs-cache/`
- **Windows:** `%USERPROFILE%\.mcp-docs-cache\`

Structure:

```
.mcp-docs-cache/
├── github/
│   └── owner_repo/
│       ├── meta.json
│       ├── search-index.json
│       └── content/*.md
└── scraped/
    └── domain_path/
        ├── meta.json
        ├── search-index.json
        └── content/*.md
```

## Troubleshooting

### "GitHub API rate limit exceeded"

Add a `GITHUB_TOKEN` environment variable (see Configuration above).

### "Documentation not found in cache"

Run `index_docs` first to fetch and cache the documentation.

### "No content found" when scraping

The site may block automated access, or the URL doesn't contain documentation. Try:

1. Use `detect_github_repo` to find a GitHub source instead
2. Try a more specific URL (e.g., `/docs` instead of homepage)

### "Website blocked automated access"

Some sites block scraping. Use `detect_github_repo` to find a GitHub alternative.

## Development

```bash
# Install dependencies
pnpm install

# Development mode (with hot reload)
pnpm dev

# Build for production
pnpm build

# Run the built server
pnpm start
```

### Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server setup
├── tools/                # Tool implementations
├── services/             # Core logic (GitHub, scraper, cache)
├── types/                # TypeScript types
└── utils/                # Helpers
```

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `pnpm build` to ensure it compiles
5. Test with a real MCP client (Claude Desktop or Cursor)
6. Submit a PR

See the [`plan/`](./plan/) directory for architecture decisions and implementation details.

## Acknowledgments

Built with:

- [Model Context Protocol](https://modelcontextprotocol.io/) — AI tool interoperability standard
- [MiniSearch](https://github.com/lucaong/minisearch) — Lightweight full-text search
- [Cheerio](https://github.com/cheeriojs/cheerio) — Fast HTML parsing
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion

## License

MIT License — see [LICENSE](LICENSE) for details.
