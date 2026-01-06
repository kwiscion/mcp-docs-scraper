# 01 - UX and Behavior Specification

## Overview

The MCP Docs Scraper provides coding agents with a clean interface to fetch, cache, and navigate software library documentation. The agent interacts through MCP tools - no manual setup beyond running the server.

---

## User Personas

### Primary: Coding Agent (LLM)

- Needs documentation to understand APIs, fix bugs, implement features
- Works iteratively - may need different parts of docs at different times
- Token-conscious - doesn't want 500 pages when 1 page suffices

### Secondary: Developer (Human)

- Sets up the MCP server in their IDE (Cursor, VSCode, etc.)
- May want to pre-cache docs for projects they work on frequently
- Wants zero-config, "just works" experience

---

## Core Workflows

### Workflow 1: Agent Needs Docs for a Library

```
Agent: "I need to understand Zod's custom validation"

Step 1: Agent tries to detect GitHub repo
        → detect_github_repo({ url: "https://zod.dev" })
        → Returns: { found: true, repo: "colinhacks/zod", docs_path: "README.md" }

Step 2: Agent indexes the documentation
        → index_docs({ url: "https://github.com/colinhacks/zod" })
        → Returns: { id: "colinhacks_zod", source: "github", tree: {...} }

Step 3: Agent browses structure
        → get_docs_tree({ docs_id: "colinhacks_zod" })
        → Returns hierarchical tree of all doc files

Step 4: Agent searches for specific topic
        → search_docs({ docs_id: "colinhacks_zod", query: "custom validation" })
        → Returns relevant file paths with snippets

Step 5: Agent fetches specific content
        → get_docs_content({ docs_id: "colinhacks_zod", paths: ["README.md#custom-schemas"] })
        → Returns clean markdown content
```

### Workflow 2: No GitHub Available (Scraping Fallback)

```
Agent: "I need docs for some-closed-source-tool.com"

Step 1: Agent attempts GitHub detection (fails)
        → detect_github_repo({ url: "https://docs.some-tool.com" })
        → Returns: { found: false }

Step 2: Agent indexes via scraping
        → index_docs({ url: "https://docs.some-tool.com", type: "scrape", depth: 2 })
        → Returns: { id: "some-tool_docs", source: "scraped", tree: {...} }

Step 3-5: Same as Workflow 1 (tree, search, content)
```

### Workflow 3: Re-accessing Cached Docs

```
Agent: "I need more info from Zod docs" (already indexed earlier)

Step 1: Agent lists cached docs
        → list_cached_docs()
        → Returns: [{ id: "colinhacks_zod", indexed_at: "...", source: "github" }]

Step 2: Agent directly uses cached tree/content
        → get_docs_tree({ docs_id: "colinhacks_zod" })
        → (Instant, from cache)
```

---

## MCP Tools Specification

### `detect_github_repo`

**Purpose:** Find GitHub repository from a docs website URL

**Input:**

```typescript
{
  url: string; // Docs website URL (e.g., "https://zod.dev")
}
```

**Output:**

```typescript
{
  found: boolean,
  repo?: string,        // "owner/repo" format
  docs_path?: string,   // Path within repo (e.g., "/docs", "/content")
  confidence: "high" | "medium" | "low",
  detection_method?: string  // How we found it (for debugging)
}
```

**Behavior:**

1. Fetch the docs homepage
2. Look for GitHub links in: meta tags, header, footer, "Edit on GitHub" links
3. Check URL patterns (_.github.io → github.com/_)
4. Return best candidate with confidence score

---

### `index_docs`

**Purpose:** Fetch and cache documentation from a source

**Input:**

```typescript
{
  url: string,                    // GitHub repo URL or docs website
  type?: "github" | "scrape" | "auto",  // Detection method (default: auto)
  depth?: number,                 // Crawl depth for scraping (default: 2)
  include_patterns?: string[],    // URL patterns to include (e.g., ["/api/*"])
  exclude_patterns?: string[],    // URL patterns to exclude (e.g., ["/blog/*"])
  force_refresh?: boolean         // Ignore cache, re-fetch (default: false)
}
```

**Output:**

```typescript
{
  id: string,                     // Unique cache ID for this docs set
  source: "github" | "scraped",
  repo?: string,                  // If GitHub source
  base_url?: string,              // If scraped source
  tree: DocsTreeNode[],           // Top-level structure
  stats: {
    pages: number,
    total_size_bytes: number,
    indexed_at: string            // ISO timestamp
  }
}
```

**Behavior:**

1. If `type: "auto"`, detect if URL is GitHub or attempt GitHub detection
2. For GitHub: use Contents API to fetch file tree, download markdown files
3. For scraping: crawl starting URL, follow links up to depth, clean HTML→Markdown
4. Store in local cache
5. Return summary with tree structure

---

### `get_docs_tree`

**Purpose:** Get the hierarchical structure of indexed docs

**Input:**

```typescript
{
  docs_id: string,      // From index_docs response
  path?: string,        // Subtree path (optional, default: root)
  max_depth?: number    // How deep to return (default: unlimited)
}
```

**Output:**

```typescript
{
  docs_id: string,
  path: string,
  tree: DocsTreeNode[]
}

interface DocsTreeNode {
  name: string,           // File or folder name
  path: string,           // Full path from root
  type: "file" | "folder",
  size_bytes?: number,    // For files
  children?: DocsTreeNode[]  // For folders
}
```

---

### `get_docs_content`

**Purpose:** Retrieve actual content of specific doc files

**Input:**

```typescript
{
  docs_id: string,
  paths: string[],        // Array of file paths to fetch
  format?: "markdown" | "raw"  // Output format (default: markdown)
}
```

**Output:**

```typescript
{
  docs_id: string,
  contents: {
    [path: string]: {
      content: string,        // The actual content
      title?: string,         // Extracted title
      headings: string[],     // List of headings for quick nav
      size_bytes: number
    }
  },
  not_found: string[]         // Paths that don't exist
}
```

---

### `search_docs`

**Purpose:** Full-text search within cached documentation

**Input:**

```typescript
{
  docs_id: string,
  query: string,
  limit?: number          // Max results (default: 10)
}
```

**Output:**

```typescript
{
  docs_id: string,
  query: string,
  results: Array<{
    path: string,
    title: string,
    snippet: string,      // Matching excerpt with context
    score: number         // Relevance score
  }>
}
```

---

### `list_cached_docs`

**Purpose:** List all documentation sets in the local cache

**Input:**

```typescript
{
} // No parameters
```

**Output:**

```typescript
{
  docs: Array<{
    id: string;
    source: "github" | "scraped";
    repo?: string;
    base_url?: string;
    indexed_at: string;
    page_count: number;
    total_size_bytes: number;
  }>;
}
```

---

### `clear_cache`

**Purpose:** Remove cached documentation

**Input:**

```typescript
{
  docs_id?: string,       // Specific docs to clear (optional)
  all?: boolean           // Clear everything (default: false)
}
```

**Output:**

```typescript
{
  cleared: string[],      // IDs that were cleared
  remaining: number       // Count of remaining cached docs
}
```

---

## Content Cleaning Rules

When converting scraped HTML to Markdown:

1. **Remove navigation elements:** `<nav>`, `<header>`, `<footer>`, `<aside>`, `[role="navigation"]`
2. **Remove scripts/styles:** `<script>`, `<style>`, `<noscript>`
3. **Remove ads/tracking:** Common ad selectors, tracking pixels
4. **Preserve code blocks:** Keep `<pre>`, `<code>` with language hints
5. **Extract main content:** Prioritize `<main>`, `<article>`, `[role="main"]`, `.content`, `#content`
6. **Convert tables:** Preserve table structure in Markdown
7. **Handle images:** Keep alt text, optionally keep URLs

---

## Error Handling

| Error             | User Message                                                                      | Recovery                          |
| ----------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| GitHub rate limit | "GitHub API rate limit reached. Try again in X minutes or use scraping fallback." | Suggest `type: "scrape"`          |
| Invalid URL       | "Could not access URL. Check the URL is correct and accessible."                  | -                                 |
| No content found  | "No documentation content found at this URL."                                     | Suggest different URL or patterns |
| Cache not found   | "Documentation not found in cache. Run index_docs first."                         | -                                 |
| Scraping blocked  | "Website blocked automated access."                                               | Suggest GitHub alternative        |

---

## Cache Behavior

- **Location:** `~/.mcp-docs-cache/` (cross-platform home directory)
- **Structure:**
  ```
  ~/.mcp-docs-cache/
  ├── github/
  │   └── {owner}_{repo}/
  │       ├── meta.json
  │       └── content/
  │           └── {file_path}.md
  └── scraped/
      └── {domain}_{hash}/
          ├── meta.json
          └── content/
              └── {url_path}.md
  ```
- **Default TTL:** 7 days for GitHub, 24 hours for scraped
- **Size limit:** None enforced (user manages their own disk)
