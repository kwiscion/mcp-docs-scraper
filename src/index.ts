#!/usr/bin/env node

import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  await server.run();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

