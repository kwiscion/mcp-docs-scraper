import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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
