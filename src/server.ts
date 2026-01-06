import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { listCachedDocs, clearCache } from "./tools/index.js";

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
