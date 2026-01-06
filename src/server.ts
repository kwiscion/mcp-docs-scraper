import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { listCachedDocs, clearCache, indexDocs, getDocsTree } from "./tools/index.js";

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
  server.tool("ping", "Health check tool - returns pong", {}, async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ message: "pong" }, null, 2),
        },
      ],
    };
  });

  // Register list_cached_docs tool
  server.tool(
    "list_cached_docs",
    "List all documentation sets in the local cache",
    {},
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
  server.tool(
    "clear_cache",
    "Remove cached documentation. Pass docs_id to clear specific entry, or all:true to clear everything.",
    {
      docs_id: {
        type: "string",
        description: "Specific docs ID to clear (optional)",
      },
      all: {
        type: "boolean",
        description: "Clear all cached docs (default: false)",
      },
    },
    async (params) => {
      const result = await clearCache({
        docs_id: params.docs_id as string | undefined,
        all: params.all as boolean | undefined,
      });
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
  server.tool(
    "index_docs",
    "Fetch and cache documentation from a GitHub repository. Downloads markdown files and stores them locally for fast access.",
    {
      url: {
        type: "string",
        description:
          "GitHub repository URL (e.g., https://github.com/owner/repo)",
      },
      type: {
        type: "string",
        description:
          'Source type: "github", "scrape", or "auto" (default: auto)',
      },
      force_refresh: {
        type: "boolean",
        description: "Ignore cache and re-fetch (default: false)",
      },
    },
    async (params) => {
      try {
        const result = await indexDocs({
          url: params.url as string,
          type: params.type as "github" | "scrape" | "auto" | undefined,
          force_refresh: params.force_refresh as boolean | undefined,
        });
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
  server.tool(
    "get_docs_tree",
    "Get the hierarchical file tree for cached documentation. Use after index_docs to browse available files.",
    {
      docs_id: {
        type: "string",
        description: "The docs ID from index_docs response (required)",
      },
      path: {
        type: "string",
        description: "Subtree path to filter (optional, default: root)",
      },
      max_depth: {
        type: "number",
        description: "Maximum depth to return (optional, default: unlimited)",
      },
    },
    async (params) => {
      try {
        const result = await getDocsTree({
          docs_id: params.docs_id as string,
          path: params.path as string | undefined,
          max_depth: params.max_depth as number | undefined,
        });
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
