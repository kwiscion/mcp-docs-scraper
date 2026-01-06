# MCP Docs Scraper - Development Plan

## What We're Shipping

- **An MCP server** that gives coding agents fast, efficient access to library documentation
- **GitHub-first fetching** - pulls docs directly from repos when possible (cleaner, faster)
- **Smart web scraping fallback** - crawls and cleans docs sites when no repo is available
- **Stateful caching** - no duplicate fetches; instant re-reads

## Target stack:

- Node.js + TypeScript (5.9+)
- MCP SDK (`@modelcontextprotocol/sdk` 1.25+)
- Cheerio 1.1+ for HTML parsing
- Turndown 7.2+ for HTML→Markdown conversion
- MiniSearch 7.0+ for full-text search
- Local filesystem cache

## Locked Product Decisions

| Decision                  | Rationale                                        |
| ------------------------- | ------------------------------------------------ |
| **TypeScript only**       | Best MCP SDK support, type safety                |
| **stdio transport**       | Simplest setup for local MCP servers             |
| **Local file cache**      | No external dependencies, works offline          |
| **GitHub-first strategy** | Cleaner source, no scraping overhead             |
| **No auth required**      | Uses public GitHub API (60 req/hr limit is fine) |
| **Markdown output**       | Universal format, token-efficient for agents     |

## How to Follow These Docs

1. **Read UX first** (`01-ux-and-behavior.md`) - understand what we're building
2. **Use slices as source of truth** (`03-incremental-implementation-slices.md`)
3. **One slice per PR** - don't bundle unrelated changes
4. **Don't proceed until checkpoint passes** - each slice has a manual verification step

## Document Map

| Doc                                                                                  | Purpose                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------- |
| [01-ux-and-behavior.md](./01-ux-and-behavior.md)                                     | What the user/agent experiences              |
| [02-implementation-notes.md](./02-implementation-notes.md)                           | Engineering details, gotchas, file structure |
| [03-incremental-implementation-slices.md](./03-incremental-implementation-slices.md) | **Source of truth** - ordered execution plan |
| [TASKS.md](./TASKS.md)                                                               | Assignable task list (1:1 with slices)       |
| [TECHNOLOGY-RESEARCH.md](./TECHNOLOGY-RESEARCH.md)                                   | Technology verification and version audit    |
