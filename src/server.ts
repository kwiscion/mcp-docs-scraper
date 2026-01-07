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

export interface DocsScraperServer {
  run(): Promise<void>;
  close(): Promise<void>;
}

export function createServer(): DocsScraperServer {
  const server = new McpServer({
    name: "mcp-docs-scraper",
    version: "0.1.0",
  });

  // Register the ping tool - a simple health check
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Health check tool - returns pong",
      inputSchema: {},
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ message: "pong" }, null, 2),
          },
        ],
      };
    }
  );

  // Register list_cached_docs tool
  server.registerTool(
    "list_cached_docs",
    {
      title: "List Cached Docs",
      description: "List all documentation sets in the local cache",
      inputSchema: {},
    },
    async () => {
      const result = await listCachedDocs();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register clear_cache tool
  server.registerTool(
    "clear_cache",
    {
      title: "Clear Cache",
      description:
        "Remove cached documentation. Pass docs_id to clear specific entry, or all:true to clear everything.",
      inputSchema: {
        docs_id: z
          .string()
          .optional()
          .describe("Specific docs ID to clear (optional)"),
        all: z
          .boolean()
          .optional()
          .describe("Clear all cached docs (default: false)"),
      },
    },
    async ({ docs_id, all }) => {
      const result = await clearCache({ docs_id, all });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register index_docs tool
  server.registerTool(
    "index_docs",
    {
      title: "Index Docs",
      description:
        "Fetch and cache documentation from a GitHub repository. Downloads markdown files and stores them locally for fast access.",
      inputSchema: {
        url: z
          .string()
          .describe(
            "GitHub repository URL (e.g., https://github.com/owner/repo)"
          ),
        type: z
          .enum(["github", "scrape", "auto"])
          .optional()
          .describe(
            'Source type: "github", "scrape", or "auto" (default: auto)'
          ),
        force_refresh: z
          .boolean()
          .optional()
          .describe("Ignore cache and re-fetch (default: false)"),
      },
    },
    async ({ url, type, force_refresh }) => {
      try {
        const result = await indexDocs({ url, type, force_refresh });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register get_docs_tree tool
  server.registerTool(
    "get_docs_tree",
    {
      title: "Get Docs Tree",
      description:
        "Get the hierarchical file tree for cached documentation. Use after index_docs to browse available files.",
      inputSchema: {
        docs_id: z
          .string()
          .describe("The docs ID from index_docs response (required)"),
        path: z
          .string()
          .optional()
          .describe("Subtree path to filter (optional, default: root)"),
        max_depth: z
          .number()
          .optional()
          .describe("Maximum depth to return (optional, default: unlimited)"),
      },
    },
    async ({ docs_id, path, max_depth }) => {
      try {
        const result = await getDocsTree({ docs_id, path, max_depth });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register get_docs_content tool
  server.registerTool(
    "get_docs_content",
    {
      title: "Get Docs Content",
      description:
        "Retrieve actual content of specific doc files from cache. Returns content with extracted headings for navigation.",
      inputSchema: {
        docs_id: z
          .string()
          .describe("The docs ID from index_docs response (required)"),
        paths: z
          .array(z.string())
          .describe("Array of file paths to fetch (required)"),
        format: z
          .enum(["markdown", "raw"])
          .optional()
          .describe('Output format: "markdown" or "raw" (default: markdown)'),
      },
    },
    async ({ docs_id, paths, format }) => {
      try {
        const result = await getDocsContent({ docs_id, paths, format });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register search_docs tool
  server.registerTool(
    "search_docs",
    {
      title: "Search Docs",
      description:
        "Full-text search within cached documentation. Returns relevant results with matching snippets.",
      inputSchema: {
        docs_id: z
          .string()
          .describe("The docs ID from index_docs response (required)"),
        query: z.string().describe("Search query (required)"),
        limit: z
          .number()
          .optional()
          .describe("Max results to return (default: 10, max: 50)"),
      },
    },
    async ({ docs_id, query, limit }) => {
      try {
        const result = await searchDocs({ docs_id, query, limit });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register detect_github_repo tool
  server.registerTool(
    "detect_github_repo",
    {
      title: "Detect GitHub Repo",
      description:
        "Find GitHub repository from a documentation website URL. Use before index_docs to check if a site has a GitHub repo.",
      inputSchema: {
        url: z
          .string()
          .describe("Docs website URL to analyze (e.g., https://zod.dev)"),
      },
    },
    async ({ url }) => {
      try {
        const result = await detectGitHub({ url });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

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
