# 02 - Implementation Notes

## Project Structure

```
mcp-docs-scraper/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── server.ts             # MCP server class with tool handlers
│   ├── tools/                # Tool implementations
│   │   ├── index.ts          # Tool registry
│   │   ├── detect-github.ts  # detect_github_repo tool
│   │   ├── index-docs.ts     # index_docs tool
│   │   ├── get-tree.ts       # get_docs_tree tool
│   │   ├── get-content.ts    # get_docs_content tool
│   │   ├── search-docs.ts    # search_docs tool
│   │   ├── list-cached.ts    # list_cached_docs tool
│   │   └── clear-cache.ts    # clear_cache tool
│   ├── services/             # Core business logic
│   │   ├── github-fetcher.ts # GitHub API interactions
│   │   ├── web-scraper.ts    # Web crawling & scraping
│   │   ├── content-cleaner.ts# HTML→Markdown conversion
│   │   ├── cache-manager.ts  # Local filesystem cache
│   │   └── search-index.ts   # Full-text search
│   ├── types/                # TypeScript types
│   │   ├── index.ts          # Shared types
│   │   ├── tools.ts          # Tool input/output types
│   │   └── cache.ts          # Cache structure types
│   └── utils/                # Helpers
│       ├── url.ts            # URL parsing utilities
│       ├── fs.ts             # Filesystem helpers
│       └── rate-limit.ts     # Rate limiting for APIs
├── tests/                    # Test files (mirrors src/)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md                 # User-facing docs
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0",
    "cheerio": "^1.1.2",
    "turndown": "^7.2.0",
    "minisearch": "^7.0.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "tsx": "^4.21.0",
    "@types/node": "^22.0.0",
    "@types/turndown": "^5.0.0"
  }
}
```

### Why These Libraries?

| Library                     | Purpose                      | Alternatives Considered                           |
| --------------------------- | ---------------------------- | ------------------------------------------------- |
| `@modelcontextprotocol/sdk` | Official MCP SDK             | None (required)                                   |
| `cheerio`                   | HTML parsing (server-side)   | jsdom (heavier), htmlparser2 (lower-level)        |
| `turndown`                  | HTML→Markdown                | unified/rehype (more complex), custom (more work) |
| `minisearch`                | Lightweight full-text search | lunr (larger), flexsearch (similar)               |

### Version Notes & Breaking Changes

**MiniSearch 7.x** (upgraded from 6.x):
- Targets ES6 (ES2015+) - won't work in IE11 or earlier
- Better TypeScript typing for `combineWith` search options
- Fixed tokenizer regression with contiguous spaces/punctuation
- No issues for Node.js environments (ES6 fully supported)

**@types/node 22.x+** (upgraded from 20.x):
- Provides types for latest Node.js LTS features
- Recommended to match current Node.js runtime

**MCP SDK 1.25.x**:
- Latest stable version (v2 planned for Q1 2026)
- v1.x will receive bug fixes and security updates for 6+ months after v2 ships

---

## GitHub API Strategy

### Endpoints Used

1. **Contents API** - Get file/folder listings

   ```
   GET https://api.github.com/repos/{owner}/{repo}/contents/{path}
   ```

   - Returns: Array of file/folder objects with names, paths, sizes
   - Rate limit: 60/hour unauthenticated

2. **Raw Content** - Download actual files
   ```
   GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
   ```
   - Returns: Raw file content
   - No rate limit (CDN)

### Rate Limit Handling

- Track remaining requests via `X-RateLimit-Remaining` header
- If < 5 remaining, pause and warn user
- Never hit rate limit unexpectedly

### Branch Detection

1. Try `main` first (most common)
2. Fallback to `master`
3. Use GitHub API default branch if both fail

---

## Web Scraping Strategy

### Crawling Rules

1. **Respect robots.txt** - Check before crawling
2. **Delay between requests** - 500ms minimum
3. **Depth limit** - Default 2, max 5
4. **Same-domain only** - Don't follow external links
5. **Content-type filter** - Only HTML pages

### URL Normalization

- Remove fragments (#section)
- Remove tracking parameters (utm\_\*, ref, etc.)
- Normalize trailing slashes
- Decode URL-encoded characters

### Content Extraction Priority

1. `<main>` element
2. `<article>` element
3. `[role="main"]` attribute
4. `.content`, `.documentation`, `.docs` classes
5. `#content`, `#main` IDs
6. Largest text block as fallback

---

## Content Cleaning Pipeline

```
HTML Input
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Remove unwanted elements         │
│    - <script>, <style>, <nav>       │
│    - <header>, <footer>, <aside>    │
│    - Ads, tracking, comments        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Extract main content             │
│    - Find primary content container │
│    - Remove boilerplate             │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Convert to Markdown              │
│    - Headings: <h1>→#, <h2>→##      │
│    - Code: preserve language hints  │
│    - Links: convert to [text](url)  │
│    - Lists: preserve nesting        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Post-process                     │
│    - Normalize whitespace           │
│    - Fix broken markdown            │
│    - Extract headings list          │
└─────────────────────────────────────┘
    │
    ▼
Markdown Output
```

### Turndown Configuration

````typescript
const turndownService = new TurndownService({
  headingStyle: "atx", // # style headings
  codeBlockStyle: "fenced", // ``` code blocks
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Remove unwanted elements completely
turndownService.remove(["script", "style", "noscript", "iframe"]);

// Preserve code block language hints
turndownService.addRule("fencedCodeBlock", {
  filter: (node) =>
    node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
  replacement: (content, node) => {
    const code = node.firstChild as HTMLElement;
    const lang = code.className?.match(/language-(\w+)/)?.[1] || "";
    return `\n\`\`\`${lang}\n${code.textContent}\n\`\`\`\n`;
  },
});

// Convert relative URLs to absolute for scraped content
turndownService.addRule("absoluteLinks", {
  filter: "a",
  replacement: (content, node) => {
    const href = node.getAttribute("href");
    if (!href) return content;

    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(href, baseUrl).href;
      return `[${content}](${absoluteUrl})`;
    } catch {
      // If URL is invalid, return as-is
      return `[${content}](${href})`;
    }
  },
});
````

**Note:** The `baseUrl` variable should be passed to the content cleaner service for proper relative URL resolution.

---

## Cache Structure

### Meta File (`meta.json`)

```typescript
interface CacheMeta {
  id: string;
  source: "github" | "scraped";

  // For GitHub sources
  repo?: string;
  branch?: string;

  // For scraped sources
  base_url?: string;

  // Common fields
  indexed_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp
  page_count: number;
  total_size_bytes: number;

  // File tree
  tree: DocsTreeNode[];
}
```

### Content Files

- Stored as `.md` files
- Path mirrors source structure
- Example: `/docs/api/hooks.md` → `content/docs/api/hooks.md`

### Search Index

- Built on-demand when first search happens
- Stored as `search-index.json`
- Rebuilt if content changes

---

## Error Handling Patterns

### Graceful Degradation

```typescript
async function fetchWithFallback(url: string): Promise<Content> {
  // Try GitHub first
  const githubResult = await tryGitHub(url);
  if (githubResult.success) return githubResult.content;

  // Fall back to scraping
  const scrapeResult = await tryScrape(url);
  if (scrapeResult.success) return scrapeResult.content;

  // Both failed
  throw new DocsError(
    "FETCH_FAILED",
    "Could not fetch documentation from any source"
  );
}
```

### Custom Error Types

```typescript
class DocsError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DocsError";
  }
}

// Usage
throw new DocsError("RATE_LIMIT", "GitHub API rate limit reached", {
  resetAt: new Date(resetTimestamp).toISOString(),
  remaining: 0,
});
```

---

## Performance Considerations

### Memory Management

- Stream large files instead of loading into memory
- Process pages one at a time during scraping
- Limit search index size (exclude very large files)

### Caching Efficiency

- Use ETags for GitHub API (avoids re-downloading unchanged content)
- Store compiled search index (don't rebuild on every search)
- Lazy-load content (tree structure is small, content loaded on demand)

### Response Size

- Tool responses should be under 100KB when possible
- For large docs, return summaries and let agent fetch specifics
- Paginate large tree structures if needed

---

## Platform Considerations

### Windows Compatibility

- Use `path.join()` for all paths
- Handle both `/` and `\` in file paths
- Use `os.homedir()` for cache location

### File System

- Use async fs operations throughout
- Handle permission errors gracefully
- Create directories recursively when needed

---

## Testing Strategy

### Unit Tests

- GitHub fetcher: mock API responses
- Web scraper: use recorded HTML fixtures
- Content cleaner: input/output pairs

### Integration Tests

- Real GitHub API (use small, stable repos)
- Full tool flows with cache

### Manual Testing

- Test with popular library docs (React, Zod, etc.)
- Verify in Cursor/Claude Desktop
