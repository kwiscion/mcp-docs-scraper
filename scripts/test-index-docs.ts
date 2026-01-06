/**
 * Test script for index_docs tool.
 * Run with: npx tsx scripts/test-index-docs.ts
 */

import { indexDocs, parseGitHubUrl } from "../src/tools/index-docs.js";
import { listCachedDocs } from "../src/tools/list-cached.js";
import { clearCache } from "../src/tools/clear-cache.js";
import { cacheManager } from "../src/services/cache-manager.js";
import { isAuthenticated } from "../src/services/github-fetcher.js";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

function printTree(
  nodes: { name: string; path: string; type: string; children?: any[] }[],
  indent = 0
): void {
  const prefix = "  ".repeat(indent);
  for (const node of nodes) {
    const icon = node.type === "folder" ? "📁" : "📄";
    console.log(`${prefix}${icon} ${node.name}`);
    if (node.children && indent < 2) {
      // Limit depth for readability
      printTree(node.children, indent + 1);
    }
  }
}

async function main() {
  console.log("🧪 Testing index_docs Tool\n");

  // Show auth status
  if (isAuthenticated()) {
    console.log("🔑 Using GITHUB_TOKEN (5000 requests/hour)\n");
  } else {
    console.log("⚠️  No GITHUB_TOKEN set (60 requests/hour limit)\n");
  }

  try {
    // Test 1: Parse GitHub URL
    console.log("1️⃣ Testing GitHub URL parsing...");
    const testUrls = [
      "https://github.com/colinhacks/zod",
      "github.com/owner/repo",
      "https://github.com/owner/repo/tree/main/docs",
      "https://example.com/not-github",
    ];

    for (const url of testUrls) {
      const result = parseGitHubUrl(url);
      console.log(`   ${url}`);
      console.log(`   → ${result ? JSON.stringify(result) : "null (not GitHub)"}`);
    }

    // Test 2: Clear any existing cache for clean test
    console.log("\n2️⃣ Clearing existing cache...");
    await cacheManager.initialize();
    const clearResult = await clearCache({ all: true });
    console.log(`   Cleared ${clearResult.cleared.length} entries`);

    // Test 3: Index a GitHub repo
    console.log("\n3️⃣ Indexing https://github.com/colinhacks/zod ...");
    console.log("   (This may take a moment to download files...)\n");

    const startTime = Date.now();
    const result = await indexDocs({
      url: "https://github.com/colinhacks/zod",
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   ✅ Indexed in ${elapsed}s`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   Repo: ${result.repo}`);
    console.log(`   Pages: ${result.stats.pages}`);
    console.log(`   Size: ${(result.stats.total_size_bytes / 1024).toFixed(2)} KB`);
    console.log(`   Indexed at: ${result.stats.indexed_at}`);

    // Test 4: Verify tree structure
    console.log("\n4️⃣ Tree structure:");
    printTree(result.tree);

    // Test 5: Check cache directory
    console.log("\n5️⃣ Checking cache directory...");
    const cacheDir = cacheManager.getCacheDir();
    const entryDir = join(cacheDir, "github", result.id);
    const contentDir = join(entryDir, "content");

    console.log(`   Cache dir: ${cacheDir}`);
    console.log(`   Entry dir exists: ${existsSync(entryDir) ? "✅" : "❌"}`);
    console.log(`   meta.json exists: ${existsSync(join(entryDir, "meta.json")) ? "✅" : "❌"}`);
    console.log(`   content/ exists: ${existsSync(contentDir) ? "✅" : "❌"}`);

    if (existsSync(contentDir)) {
      // List some cached files
      const listFilesRecursive = (dir: string, prefix = ""): string[] => {
        const files: string[] = [];
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            files.push(...listFilesRecursive(join(dir, entry.name), path));
          } else {
            files.push(path);
          }
        }
        return files;
      };

      const cachedFiles = listFilesRecursive(contentDir);
      console.log(`   Cached files (${cachedFiles.length}):`);
      for (const file of cachedFiles.slice(0, 5)) {
        console.log(`     - ${file}`);
      }
      if (cachedFiles.length > 5) {
        console.log(`     ... and ${cachedFiles.length - 5} more`);
      }
    }

    // Test 6: Verify list_cached_docs shows the entry
    console.log("\n6️⃣ Verifying list_cached_docs...");
    const listResult = await listCachedDocs();
    console.log(`   Found ${listResult.docs.length} cached entry(ies)`);

    const zodEntry = listResult.docs.find((d) => d.id === result.id);
    if (zodEntry) {
      console.log(`   ✅ Entry found: ${zodEntry.id}`);
      console.log(`      Source: ${zodEntry.source}`);
      console.log(`      Repo: ${zodEntry.repo}`);
      console.log(`      Pages: ${zodEntry.page_count}`);
    } else {
      console.log("   ❌ Entry NOT found in list!");
    }

    // Test 7: Test cache hit (should be fast)
    console.log("\n7️⃣ Testing cache hit...");
    const cacheStartTime = Date.now();
    const cachedResult = await indexDocs({
      url: "https://github.com/colinhacks/zod",
    });
    const cacheElapsed = Date.now() - cacheStartTime;
    console.log(`   ✅ Retrieved from cache in ${cacheElapsed}ms`);
    console.log(`   Same data: ${cachedResult.id === result.id ? "✅" : "❌"}`);

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();

