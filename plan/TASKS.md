# TASKS - MCP Docs Scraper

> Each task maps 1:1 to a slice in `03-incremental-implementation-slices.md`.  
> Complete in order. Don't skip ahead.

---

## Phase 1: Foundation

- **[DONE]** Task 1: Project Scaffolding & Hello World MCP Server

  - Create package.json, tsconfig.json, basic project structure
  - Implement minimal MCP server with `ping` tool
  - Verify MCP pipeline works end-to-end

- **[DONE]** Task 2: Cache Manager Foundation

  - Implement cache-manager service
  - Create cache types and filesystem helpers
  - Test store/retrieve/list/clear operations

- **[DONE]** Task 3: `list_cached_docs` and `clear_cache` Tools
  - Implement first real MCP tools
  - Wire tools to cache manager
  - Verify tool→service→cache pipeline

---

## Phase 2: GitHub Integration

- **[DONE]** Task 4: GitHub Fetcher - Tree Structure

  - Implement GitHub API client
  - Fetch repo file tree via Contents API
  - Track rate limits

- **[DONE]** Task 5: GitHub Fetcher - Content Download

  - Add raw file content fetching
  - Handle subdirectories
  - Graceful 404 handling

- **[DONE]** Task 6: `index_docs` Tool (GitHub Only)

  - Implement index_docs for GitHub URLs
  - Store fetched content in cache
  - Return tree structure and stats

- **[DONE]** Task 7: `get_docs_tree` Tool

  - Implement tree retrieval from cache
  - Support subtree filtering
  - Handle missing cache gracefully

- **[DONE]** Task 8: `get_docs_content` Tool
  - Implement content retrieval
  - Extract headings from content
  - Support multiple paths per request

---

## Phase 3: Search

- **[DONE]** Task 9: Full-Text Search Index

  - Integrate MiniSearch
  - Build index during docs indexing
  - Store index in cache

- **[DONE]** Task 10: `search_docs` Tool
  - Implement search tool
  - Return results with snippets
  - Respect result limits

---

## Phase 4: Web Scraping

- **[DONE]** Task 11: Content Cleaner Service

  - Implement HTML→Markdown conversion
  - Configure Turndown rules
  - Strip navigation, preserve code

- **[DONE]** Task 12: Web Scraper Service

  - Implement crawler with depth limit
  - Respect robots.txt
  - URL normalization

- **[DONE]** Task 13: `index_docs` Tool - Scraping Support
  - Add scraping path to index_docs
  - Integrate scraper and cleaner
  - Test full scrape→cache flow

---

## Phase 5: Intelligence

- **[DONE]** Task 14: GitHub Repo Detection

  - Implement detection logic
  - Create detect_github_repo tool
  - Test with various doc sites

- **[DONE]** Task 15: Auto-Detection in `index_docs`
  - Integrate detector into index_docs
  - Auto-select best source
  - Fallback chain: GitHub → scrape

---

## Phase 6: Polish

- **[TODO]** Task 16: Error Handling & Edge Cases

  - Custom error types
  - Consistent error responses
  - Graceful degradation

- **[TODO]** Task 17: Documentation & Publishing Prep
  - Complete README with examples
  - MCP config examples
  - License and metadata
