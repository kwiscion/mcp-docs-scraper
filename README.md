# MCP Docs Scraper

An MCP (Model Context Protocol) server that gives coding agents fast, efficient access to documentation.

## Features

- **GitHub-first fetching** - Pulls docs directly from GitHub repos when possible (cleaner, faster)
- **Smart web scraping fallback** - Crawls and cleans docs sites when no repo is available
- **Auto-detection** - Automatically detects GitHub repos from documentation URLs
- **Full-text search** - Search within cached documentation with snippets
- **Local caching** - No duplicate fetches, works offline after initial index

## Installation

```bash
# Clone the repository
git clone https://github.com/kwiscion/mcp-docs-scraper.git
cd mcp-docs-scraper

# Install dependencies
pnpm install

# Build
pnpm build
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project or global config):

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

### With GitHub Token (Optional)

For higher API rate limits (5000/hour vs 60/hour), set a GitHub token:

```json
{
  "mcpServers": {
    "docs-scraper": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-docs-scraper/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Available Tools

| Tool                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `ping`               | Health check - returns pong                      |
| `index_docs`         | Fetch and cache documentation from GitHub or web |
| `get_docs_tree`      | Get hierarchical structure of cached docs        |
| `get_docs_content`   | Retrieve content of specific doc files           |
| `search_docs`        | Full-text search within cached docs              |
| `detect_github_repo` | Find GitHub repo from a docs website URL         |
| `list_cached_docs`   | List all cached documentation                    |
| `clear_cache`        | Remove cached documentation                      |

### `index_docs`

Fetch and cache documentation from a GitHub repository or website.

```typescript
// Index from GitHub (auto-detected)
index_docs({ url: "https://github.com/colinhacks/zod" });

// Index from GitHub via docs site (auto-detection)
index_docs({ url: "https://zod.dev" });

// Force web scraping
index_docs({ url: "https://docs.example.com", type: "scrape", depth: 2 });

// Re-index (ignore cache)
index_docs({ url: "https://github.com/owner/repo", force_refresh: true });
```

**Returns:**

```json
{
  "id": "colinhacks_zod",
  "source": "github",
  "repo": "colinhacks/zod",
  "tree": [...],
  "stats": {
    "pages": 15,
    "total_size_bytes": 245000,
    "indexed_at": "2025-01-07T..."
  }
}
```

### `get_docs_tree`

Get the file tree for cached documentation.

```typescript
// Full tree
get_docs_tree({ docs_id: "colinhacks_zod" });

// Subtree only
get_docs_tree({ docs_id: "colinhacks_zod", path: "docs/", max_depth: 2 });
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
  "docs_id": "colinhacks_zod",
  "query": "custom validation",
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

Retrieve actual content of specific files from cache.

```typescript
get_docs_content({
  docs_id: "colinhacks_zod",
  paths: ["README.md", "docs/guide.md"],
});
```

**Returns:**

```json
{
  "docs_id": "colinhacks_zod",
  "contents": {
    "README.md": {
      "content": "# Zod\n\nTypeScript-first schema validation...",
      "title": "Zod",
      "headings": ["# Zod", "## Installation", "## Basic Usage"],
      "size_bytes": 15234
    }
  },
  "not_found": []
}
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

### `list_cached_docs`

List all documentation sets in the local cache.

```typescript
list_cached_docs();
```

### `clear_cache`

Remove cached documentation.

```typescript
// Clear specific entry
clear_cache({ docs_id: "colinhacks_zod" });

// Clear all
clear_cache({ all: true });
```

## Usage Example

Here's a typical workflow for an AI coding agent:

1. **Find the docs source:**

   ```
   detect_github_repo({ url: "https://zod.dev" })
   → { found: true, repo: "colinhacks/zod" }
   ```

2. **Index the documentation:**

   ```
   index_docs({ url: "https://github.com/colinhacks/zod" })
   → { id: "colinhacks_zod", tree: [...] }
   ```

3. **Browse the structure:**

   ```
   get_docs_tree({ docs_id: "colinhacks_zod" })
   → Returns hierarchical file tree
   ```

4. **Search for specific topics:**

   ```
   search_docs({ docs_id: "colinhacks_zod", query: "transform" })
   → Returns matching files with snippets
   ```

5. **Get the content you need:**
   ```
   get_docs_content({ docs_id: "colinhacks_zod", paths: ["README.md"] })
   → Returns full markdown content
   ```

## Cache Location

Documentation is cached locally at:

- **macOS/Linux:** `~/.mcp-docs-cache/`
- **Windows:** `%USERPROFILE%\.mcp-docs-cache\`

Structure:

```
.mcp-docs-cache/
├── github/
│   └── owner_repo/
│       ├── meta.json
│       ├── search-index.json
│       └── content/
│           └── *.md
└── scraped/
    └── domain_path/
        ├── meta.json
        ├── search-index.json
        └── content/
            └── *.md
```

## Troubleshooting

### "GitHub API rate limit exceeded"

**Solution:** Set a `GITHUB_TOKEN` environment variable for higher rate limits (see Configuration).

### "Documentation not found in cache"

**Solution:** Run `index_docs` first to fetch and cache the documentation.

### "No content found" when scraping

**Possible causes:**

- The site blocks automated access
- The URL doesn't contain documentation content
- Try a more specific URL (e.g., `/docs` instead of homepage)

**Solution:** Try using `detect_github_repo` to find a GitHub source instead.

### "Website blocked automated access"

**Solution:** The site's robots.txt or security settings prevent scraping. Try:

1. Use `detect_github_repo` to find a GitHub alternative
2. Try a different starting URL
3. Use the GitHub source if available

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run the server
pnpm start

# Development mode (with tsx)
pnpm dev
```

- Node.js 22.0.0 or higher
- pnpm (recommended) or npm

## License

MIT License - see [LICENSE](LICENSE) file for details.
