/**
 * Test script for cache manager operations.
 * Run with: npx tsx scripts/test-cache.ts
 */

import { CacheManager } from "../src/services/cache-manager.js";
import type { CacheMeta, DocsTreeNode } from "../src/types/cache.js";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  console.log("🧪 Testing Cache Manager\n");

  // Use a temp directory for testing to avoid polluting the real cache
  const testCacheDir = join(tmpdir(), `mcp-docs-cache-test-${Date.now()}`);
  const cache = new CacheManager(testCacheDir);

  try {
    // 1. Initialize cache
    console.log("1️⃣ Initializing cache manager...");
    await cache.initialize();
    console.log(`   ✅ Cache directory created at: ${cache.getCacheDir()}\n`);

    // 2. Store mock docs meta
    console.log("2️⃣ Storing mock docs metadata...");
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

    const mockMeta: Omit<CacheMeta, "expires_at"> = {
      id: "test_repo",
      source: "github",
      repo: "test/repo",
      branch: "main",
      indexed_at: new Date().toISOString(),
      page_count: 2,
      total_size_bytes: 1801,
      tree: mockTree,
    };

    await cache.storeMeta(mockMeta);
    console.log("   ✅ Meta stored for 'test_repo'\n");

    // 3. Store mock content files
    console.log("3️⃣ Storing mock content files...");
    await cache.storeContent(
      "github",
      "test_repo",
      "README.md",
      "# Test Repository\n\nThis is a test."
    );
    await cache.storeContent(
      "github",
      "test_repo",
      "docs/getting-started.md",
      "# Getting Started\n\nFollow these steps..."
    );
    console.log("   ✅ Content files stored\n");

    // 4. Retrieve meta
    console.log("4️⃣ Retrieving metadata...");
    const retrievedMeta = await cache.getMeta("github", "test_repo");
    if (retrievedMeta) {
      console.log(`   ✅ Retrieved meta for: ${retrievedMeta.id}`);
      console.log(`      Source: ${retrievedMeta.source}`);
      console.log(`      Repo: ${retrievedMeta.repo}`);
      console.log(`      Pages: ${retrievedMeta.page_count}`);
      console.log(`      Expires: ${retrievedMeta.expires_at}\n`);
    } else {
      throw new Error("Failed to retrieve meta");
    }

    // 5. Retrieve content
    console.log("5️⃣ Retrieving content files...");
    const readme = await cache.getContent("github", "test_repo", "README.md");
    const gettingStarted = await cache.getContent(
      "github",
      "test_repo",
      "docs/getting-started.md"
    );
    if (readme && gettingStarted) {
      console.log(`   ✅ README.md: "${readme.substring(0, 30)}..."`);
      console.log(`   ✅ getting-started.md: "${gettingStarted.substring(0, 30)}..."\n`);
    } else {
      throw new Error("Failed to retrieve content");
    }

    // 6. List all cached items
    console.log("6️⃣ Listing all cached entries...");
    const entries = await cache.listEntries();
    console.log(`   ✅ Found ${entries.length} entries:`);
    for (const entry of entries) {
      console.log(`      - ${entry.id} (${entry.source}): ${entry.page_count} pages`);
    }
    console.log();

    // 7. Check entry existence
    console.log("7️⃣ Checking entry existence...");
    const hasEntry = await cache.hasEntry("github", "test_repo");
    const hasNonExistent = await cache.hasEntry("github", "non_existent");
    console.log(`   ✅ Has 'test_repo': ${hasEntry}`);
    console.log(`   ✅ Has 'non_existent': ${hasNonExistent}\n`);

    // 8. Find by ID
    console.log("8️⃣ Finding entry by ID...");
    const found = await cache.findById("test_repo");
    if (found) {
      console.log(`   ✅ Found entry: ${found.id} (${found.source})\n`);
    } else {
      throw new Error("Failed to find by ID");
    }

    // 9. Check expiration
    console.log("9️⃣ Checking expiration...");
    const isExpired = cache.isExpired(retrievedMeta);
    console.log(`   ✅ Is expired: ${isExpired} (should be false)\n`);

    // 10. Clear cache
    console.log("🔟 Clearing cache...");
    const cleared = await cache.clearAll();
    console.log(`   ✅ Cleared ${cleared.length} entries: ${cleared.join(", ")}\n`);

    // 11. Verify empty
    console.log("1️⃣1️⃣ Verifying cache is empty...");
    const afterClear = await cache.listEntries();
    console.log(`   ✅ Entries remaining: ${afterClear.length}\n`);

    console.log("✅ All tests passed!");
    console.log(`\n📁 Test cache directory: ${testCacheDir}`);
    console.log("   (You can manually inspect or delete this directory)");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main();

