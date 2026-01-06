/**
 * Creates a fake cache entry for testing list_cached_docs and clear_cache tools.
 * Run with: npx tsx scripts/create-test-cache.ts
 */

import { CacheManager } from "../src/services/cache-manager.js";
import type { DocsTreeNode } from "../src/types/cache.js";

async function main() {
  console.log("Creating test cache entry...\n");

  const cache = new CacheManager();
  await cache.initialize();

  // Create a mock docs entry
  const mockTree: DocsTreeNode[] = [
    {
      name: "README.md",
      path: "README.md",
      type: "file",
      size_bytes: 1234,
    },
    {
      name: "docs",
      path: "docs",
      type: "folder",
      children: [
        {
          name: "getting-started.md",
          path: "docs/getting-started.md",
          type: "file",
          size_bytes: 567,
        },
      ],
    },
  ];

  await cache.storeMeta({
    id: "test_library",
    source: "github",
    repo: "test/library",
    branch: "main",
    indexed_at: new Date().toISOString(),
    page_count: 2,
    total_size_bytes: 1801,
    tree: mockTree,
  });

  await cache.storeContent(
    "github",
    "test_library",
    "README.md",
    "# Test Library\n\nThis is a test library for documentation."
  );

  await cache.storeContent(
    "github",
    "test_library",
    "docs/getting-started.md",
    "# Getting Started\n\nFollow these steps to get started..."
  );

  console.log("✅ Created test cache entry: test_library");
  console.log(`📁 Cache location: ${cache.getCacheDir()}`);

  // List entries to confirm
  const entries = await cache.listEntries();
  console.log(`\n📋 Current cache entries: ${entries.length}`);
  for (const entry of entries) {
    console.log(`   - ${entry.id} (${entry.source}): ${entry.page_count} pages`);
  }
}

main();

