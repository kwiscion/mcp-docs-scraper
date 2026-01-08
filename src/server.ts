import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listCachedDocs,
  clearCache,
  indexDocs,
  getDocsTree,
  getDocsContent,
  searchDocs,
  detectGitHub,
} from "./tools/index.js";
import { createErrorResponse } from "./types/errors.js";

export interface DocsScraperServer {
  run(): Promise<void>;
  close(): Promise<void>;
}

export function createServer(): DocsScraperServer {
  const server = new McpServer({
    name: "mcp-docs-scraper",
    version: "0.1.0",
  });

  // ===========================================================================
  // list_cached_docs
  // ===========================================================================
  server.registerTool(
    "list_cached_docs",
    {
      title: "List Cached Docs",
      description:
        "List all cached documentation sets. Use to find docs_id values for other tools, or check if docs need indexing. Returns: id, source (github/scraped), repo or base_url, indexed_at, page_count, total_size_bytes.",
      inputSchema: {},
    },
    async () => {
      const result = await listCachedDocs();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ===========================================================================
  // clear_cache
  // ===========================================================================
  server.registerTool(
    "clear_cache",
    {
      title: "Clear Cache",
      description:
        "Remove cached documentation. Use docs_id for specific entry, or all:true to clear everything. Returns cleared IDs and remaining count.",
      inputSchema: {
        docs_id: z
          .string()
          .optional()
          .describe("Specific docs ID to clear (e.g., 'colinhacks_zod')"),
        all: z.boolean().optional().describe("Clear all cached docs"),
      },
    },
    async ({ docs_id, all }) => {
      const result = await clearCache({ docs_id, all });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ===========================================================================
  // index_docs
  // ===========================================================================
  server.registerTool(
    "index_docs",
    {
      title: "Index Docs",
      description:
        "Fetch and cache documentation from GitHub or website. REQUIRED before search_docs/get_docs_content. Auto mode tries GitHub first (cleaner), falls back to scraping. Returns docs_id for subsequent operations.",
      inputSchema: {
        url: z
          .string()
          .describe(
            "GitHub repo URL (https://github.com/owner/repo) or docs website URL"
          ),
        type: z
          .enum(["github", "scrape", "auto"])
          .optional()
          .describe("Source type (default: auto)"),
        force_refresh: z
          .boolean()
          .optional()
          .describe("Re-fetch even if cached"),
      },
    },
    async ({ url, type, force_refresh }) => {
      try {
        const result = await indexDocs({ url, type, force_refresh });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ===========================================================================
  // get_docs_tree
  // ===========================================================================
  server.registerTool(
    "get_docs_tree",
    {
      title: "Get Docs Tree",
      description:
        "Get file/folder structure of cached docs. Use to discover file paths before get_docs_content. Optionally filter by path or limit depth.",
      inputSchema: {
        docs_id: z
          .string()
          .describe("Docs ID from index_docs or list_cached_docs"),
        path: z.string().optional().describe("Subtree path (e.g., 'docs/api')"),
        max_depth: z.number().optional().describe("Max folder depth to return"),
      },
    },
    async ({ docs_id, path, max_depth }) => {
      try {
        const result = await getDocsTree({ docs_id, path, max_depth });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ===========================================================================
  // get_docs_content
  // ===========================================================================
  server.registerTool(
    "get_docs_content",
    {
      title: "Get Docs Content",
      description:
        "Retrieve markdown content of specific files. Use after search_docs to get full content of relevant files. Returns content, title, headings, and size for each path.",
      inputSchema: {
        docs_id: z
          .string()
          .describe("Docs ID from index_docs or list_cached_docs"),
        paths: z
          .array(z.string())
          .describe(
            "File paths to retrieve (e.g., ['README.md', 'docs/guide.md'])"
          ),
        format: z
          .enum(["markdown", "raw"])
          .optional()
          .describe("Output format (default: markdown)"),
      },
    },
    async ({ docs_id, paths, format }) => {
      try {
        const result = await getDocsContent({ docs_id, paths, format });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ===========================================================================
  // search_docs
  // ===========================================================================
  server.registerTool(
    "search_docs",
    {
      title: "Search Docs",
      description:
        "Full-text search within cached docs. FASTEST way to find information—use before get_docs_content. Returns ranked results with file paths and snippets.",
      inputSchema: {
        docs_id: z
          .string()
          .describe("Docs ID from index_docs or list_cached_docs"),
        query: z
          .string()
          .describe(
            "Search query—natural language works well (e.g., 'validate email')"
          ),
        limit: z
          .number()
          .optional()
          .describe("Max results (default: 10, max: 50)"),
      },
    },
    async ({ docs_id, query, limit }) => {
      try {
        const result = await searchDocs({ docs_id, query, limit });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ===========================================================================
  // detect_github_repo
  // ===========================================================================
  server.registerTool(
    "detect_github_repo",
    {
      title: "Detect GitHub Repo",
      description:
        "Find GitHub repository from a docs website URL. Use before index_docs to check if cleaner GitHub source exists. Returns repo in 'owner/repo' format with confidence level.",
      inputSchema: {
        url: z.string().describe("Docs website URL (e.g., 'https://zod.dev')"),
      },
    },
    async ({ url }) => {
      try {
        const result = await detectGitHub({ url });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ===========================================================================
  // Server Transport
  // ===========================================================================
  const transport = new StdioServerTransport();

  return {
    async run(): Promise<void> {
      await server.connect(transport);
      console.error("MCP Docs Scraper server running on stdio");
    },

    async close(): Promise<void> {
      await server.close();
    },
  };
}
