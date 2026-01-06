# 03 - Incremental Implementation Slices

> **This is the source of truth for execution order.**  
> One slice = one PR. Don't proceed until checkpoint passes.

---

## Slice 1: Project Scaffolding & Hello World MCP Server

### Deliverable

A minimal MCP server that responds to a `ping` tool with `pong`. Verifies the entire MCP pipeline works.

### Touchpoints

- `package.json` - dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `src/index.ts` - entry point
- `src/server.ts` - basic MCP server with ping tool
- `README.md` - setup instructions

### Manual Checkpoint

1. Run `pnpm install`
2. Run `pnpm build`
3. Run `pnpm start` (should start without errors)
4. Configure in Claude Desktop or Cursor MCP settings
5. Call `ping` tool → should return `{ "message": "pong" }`

### Rollback

Delete project folder, no external state.

### Notes

- Use stdio transport only (simplest)
- Keep dependencies minimal for now
- Add `.gitignore` for node_modules, dist

---

## Slice 2: Cache Manager Foundation

### Deliverable

A working cache system that can store and retrieve JSON/text files. Not yet exposed as MCP tools.

### Touchpoints

- `src/services/cache-manager.ts` - cache operations
- `src/types/cache.ts` - cache types
- `src/utils/fs.ts` - filesystem helpers

### Manual Checkpoint

1. Write a simple test script that:
   - Initializes cache manager
   - Stores a mock docs meta + content file
   - Retrieves them back
   - Lists all cached items
   - Clears cache
2. Check `~/.mcp-docs-cache/` directory is created and populated
3. Verify cross-platform path handling (if on Windows)

### Rollback

Remove cache-manager files, delete `~/.mcp-docs-cache/` directory.

### Notes

- Use async fs operations throughout
- Handle missing directories gracefully
- Store meta.json and content separately

---

## Slice 3: `list_cached_docs` and `clear_cache` Tools

### Deliverable

First real MCP tools that interact with the cache. Agent can see what's cached and clear it.

### Touchpoints

- `src/tools/list-cached.ts` - list_cached_docs implementation
- `src/tools/clear-cache.ts` - clear_cache implementation
- `src/tools/index.ts` - tool registry
- `src/server.ts` - register new tools

### Manual Checkpoint

1. Manually create a fake cache entry (meta.json + content file)
2. Start MCP server
3. Call `list_cached_docs` → should show the fake entry
4. Call `clear_cache({ all: true })` → should remove it
5. Call `list_cached_docs` → should return empty array

### Rollback

Remove tool files, revert server.ts changes.

### Notes

- These tools are simple but prove the tool→service→cache pipeline

---

## Slice 4: GitHub Fetcher - Tree Structure

### Deliverable

Can fetch the file tree from a GitHub repository using the Contents API. Not yet exposed as tool.

### Touchpoints

- `src/services/github-fetcher.ts` - GitHub API client
- `src/types/index.ts` - shared types (DocsTreeNode)
- `src/utils/rate-limit.ts` - rate limit tracking

### Manual Checkpoint

1. Write test script that:
   - Calls `fetchRepoTree("colinhacks/zod")` (or similar small repo)
   - Logs the returned tree structure
2. Verify tree contains expected files (README.md, etc.)
3. Verify rate limit headers are tracked

### Rollback

Remove github-fetcher files.

### Notes

- Start with just tree fetching, not content
- Handle both `main` and `master` branches
- Parse rate limit headers from response

---

## Slice 5: GitHub Fetcher - Content Download

### Deliverable

Can download actual file content from GitHub via raw.githubusercontent.com.

### Touchpoints

- `src/services/github-fetcher.ts` - add `fetchFileContent` method

### Manual Checkpoint

1. Extend test script to:
   - Fetch tree for a repo
   - Download README.md content
   - Log first 500 characters
2. Verify markdown content is returned correctly
3. Test with a file in a subdirectory

### Rollback

Remove fetchFileContent method.

### Notes

- raw.githubusercontent.com has no rate limits
- Handle 404s gracefully (file might not exist)

---

## Slice 6: `index_docs` Tool (GitHub Only)

### Deliverable

The `index_docs` tool works for GitHub URLs. Fetches repo, stores in cache.

### Touchpoints

- `src/tools/index-docs.ts` - index_docs implementation
- `src/server.ts` - register tool

### Manual Checkpoint

1. Start MCP server
2. Call `index_docs({ url: "https://github.com/colinhacks/zod" })`
3. Verify response includes tree structure and stats
4. Check cache directory contains downloaded content
5. Call `list_cached_docs` → should show new entry

### Rollback

Remove index-docs.ts, revert server.ts.

### Notes

- Only support explicit GitHub URLs for now
- Parse owner/repo from URL
- Skip binary files (images, etc.)

---

## Slice 7: `get_docs_tree` Tool

### Deliverable

Agent can retrieve the file tree for any cached docs.

### Touchpoints

- `src/tools/get-tree.ts` - get_docs_tree implementation
- `src/server.ts` - register tool

### Manual Checkpoint

1. Ensure docs are indexed (from Slice 6)
2. Call `get_docs_tree({ docs_id: "colinhacks_zod" })`
3. Verify full tree returned
4. Call `get_docs_tree({ docs_id: "colinhacks_zod", path: "docs" })` (if exists)
5. Verify subtree returned

### Rollback

Remove get-tree.ts, revert server.ts.

### Notes

- Read tree from cached meta.json
- Support path filtering

---

## Slice 8: `get_docs_content` Tool

### Deliverable

Agent can fetch actual content of specific files from cache.

### Touchpoints

- `src/tools/get-content.ts` - get_docs_content implementation
- `src/server.ts` - register tool

### Manual Checkpoint

1. Ensure docs are indexed
2. Call `get_docs_content({ docs_id: "colinhacks_zod", paths: ["README.md"] })`
3. Verify markdown content returned
4. Test with multiple paths
5. Test with non-existent path → should be in `not_found` array

### Rollback

Remove get-content.ts, revert server.ts.

### Notes

- Return headings list for each file (extracted from content)
- Handle missing files gracefully

---

## Slice 9: Full-Text Search Index

### Deliverable

Search index is built when docs are indexed. Can search within cached docs.

### Touchpoints

- `src/services/search-index.ts` - search indexing with MiniSearch
- `src/services/cache-manager.ts` - integrate search index storage

### Manual Checkpoint

1. Index a repo with `index_docs`
2. Verify `search-index.json` is created in cache
3. Write test script that:
   - Loads search index
   - Searches for a known term
   - Returns relevant results with snippets

### Rollback

Remove search-index.ts, revert cache-manager changes.

### Notes

- Index title, headings, and content
- Store snippets for quick results

---

## Slice 10: `search_docs` Tool

### Deliverable

Agent can search within cached documentation.

### Touchpoints

- `src/tools/search-docs.ts` - search_docs implementation
- `src/server.ts` - register tool

### Manual Checkpoint

1. Index a repo with `index_docs`
2. Call `search_docs({ docs_id: "colinhacks_zod", query: "transform" })`
3. Verify relevant results returned with snippets
4. Test with query that has no matches → empty results

### Rollback

Remove search-docs.ts, revert server.ts.

### Notes

- Use pre-built search index
- Limit results (default 10)

---

## Slice 11: Content Cleaner Service

### Deliverable

Can convert raw HTML to clean Markdown, stripping navigation and boilerplate.

### Touchpoints

- `src/services/content-cleaner.ts` - HTML→Markdown conversion
- Add `turndown` and `cheerio` dependencies

### Manual Checkpoint

1. Write test script with sample HTML from a docs site
2. Pass through content cleaner
3. Verify:
   - Navigation removed
   - Code blocks preserved with language
   - Headings converted correctly
   - Links work in markdown format

### Rollback

Remove content-cleaner.ts.

### Notes

- This is prep for web scraping
- Configure Turndown with custom rules
- Test with real docs HTML (React, Vue, etc.)

---

## Slice 12: Web Scraper Service

### Deliverable

Can crawl a docs website and extract pages.

### Touchpoints

- `src/services/web-scraper.ts` - crawling logic
- `src/utils/url.ts` - URL utilities

### Manual Checkpoint

1. Write test script that:
   - Crawls a simple docs site (e.g., small open source project)
   - Extracts pages up to depth 2
   - Logs discovered URLs
2. Verify same-domain links only
3. Verify depth limit respected

### Rollback

Remove web-scraper.ts.

### Notes

- Respect robots.txt
- Add delay between requests (500ms)
- Normalize URLs

---

## Slice 13: `index_docs` Tool - Scraping Support

### Deliverable

`index_docs` works for non-GitHub URLs via scraping fallback.

### Touchpoints

- `src/tools/index-docs.ts` - add scraping path
- Integrate web-scraper and content-cleaner

### Manual Checkpoint

1. Call `index_docs({ url: "https://docs.some-site.com", type: "scrape" })`
2. Verify pages are crawled and cleaned
3. Verify cache is populated with markdown files
4. Use `get_docs_tree` and `get_docs_content` on scraped docs

### Rollback

Revert index-docs.ts changes.

### Notes

- Use `type: "scrape"` to force scraping
- `type: "auto"` should detect non-GitHub URLs

---

## Slice 14: GitHub Repo Detection

### Deliverable

Can detect GitHub repository from a documentation website URL.

### Touchpoints

- `src/services/github-detector.ts` - detection logic
- `src/tools/detect-github.ts` - detect_github_repo tool
- `src/server.ts` - register tool

### Manual Checkpoint

1. Call `detect_github_repo({ url: "https://zod.dev" })`
2. Verify it finds `colinhacks/zod` (or similar)
3. Test with github.io URL → should extract repo
4. Test with site that has no GitHub link → `found: false`

### Rollback

Remove github-detector.ts, detect-github.ts.

### Notes

- Check meta tags, footer links, "Edit on GitHub" links
- Return confidence level
- Don't over-engineer - agent can help

---

## Slice 15: Auto-Detection in `index_docs`

### Deliverable

`index_docs` with `type: "auto"` detects GitHub and uses it when possible.

### Touchpoints

- `src/tools/index-docs.ts` - integrate github-detector

### Manual Checkpoint

1. Call `index_docs({ url: "https://zod.dev" })` (no type specified)
2. Verify it detects GitHub and uses GitHub fetching
3. Call with URL that has no GitHub → should fall back to scraping

### Rollback

Revert index-docs.ts changes.

### Notes

- Auto-detection is the default
- Log which method was used in response

---

## Slice 16: Error Handling & Edge Cases

### Deliverable

Robust error handling throughout, graceful failures.

### Touchpoints

- `src/types/errors.ts` - custom error types
- All tool files - consistent error handling
- `src/services/*` - add error handling

### Manual Checkpoint

1. Test with invalid URL → helpful error message
2. Test with private GitHub repo → access denied message
3. Test with non-existent cache ID → clear error
4. Test with blocked scraping → suggests alternatives

### Rollback

Revert error handling changes (keep working code).

### Notes

- Use custom DocsError class
- Return structured errors to agent
- Never crash, always return something useful

---

## Slice 17: Documentation & Publishing Prep

### Deliverable

Complete README, usage examples, ready for `pnpm publish` or local use.

### Touchpoints

- `README.md` - comprehensive user docs
- `package.json` - finalize metadata
- Add `LICENSE` file

### Manual Checkpoint

1. Fresh clone of repo
2. Follow README to install and run
3. Configure in Claude Desktop
4. Complete full workflow: index → tree → search → content

### Rollback

N/A - documentation only.

### Notes

- Include MCP config examples for Cursor and Claude Desktop
- Add troubleshooting section
- Consider npx support for zero-install usage
