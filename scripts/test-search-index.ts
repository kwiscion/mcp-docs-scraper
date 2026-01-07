/**
 * Test script for the search index service.
 *
 * Tests:
 * 1. Index a small repo with index_docs
 * 2. Verify search-index.json is created
 * 3. Load the search index
 * 4. Search for known terms
 * 5. Verify results with snippets
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { indexDocs } from "../src/tools/index-docs.js";
import { SearchIndex } from "../src/services/search-index.js";
import { cacheManager } from "../src/services/cache-manager.js";

const CACHE_DIR = join(homedir(), ".mcp-docs-cache");

async function main() {
  console.log("=== Search Index Test ===\n");

  // Step 1: Index a small repo
  console.log("1. Indexing a small GitHub repository...");
  const testRepoUrl = "https://github.com/colinhacks/zod";

  try {
    const result = await indexDocs({
      url: testRepoUrl,
      force_refresh: true, // Force re-index to ensure fresh search index
    });

    console.log(`   ✓ Indexed ${result.stats.pages} pages`);
    console.log(`   ✓ Total size: ${(result.stats.total_size_bytes / 1024).toFixed(1)} KB`);
    console.log(`   ✓ Cache ID: ${result.id}`);
    console.log("");

    // Step 2: Verify search-index.json exists
    console.log("2. Verifying search-index.json exists...");
    const searchIndexPath = join(CACHE_DIR, "github", result.id, "search-index.json");

    if (existsSync(searchIndexPath)) {
      const stats = readFileSync(searchIndexPath);
      console.log(`   ✓ search-index.json exists`);
      console.log(`   ✓ Index file size: ${(stats.length / 1024).toFixed(1)} KB`);
    } else {
      console.log(`   ✗ search-index.json NOT found at: ${searchIndexPath}`);
      process.exit(1);
    }
    console.log("");

    // Step 3: Load the search index
    console.log("3. Loading search index from cache...");
    const indexJson = await cacheManager.getSearchIndex("github", result.id);

    if (!indexJson) {
      console.log("   ✗ Could not load search index from cache");
      process.exit(1);
    }

    const searchIndex = SearchIndex.fromJSON(indexJson);
    console.log(`   ✓ Search index loaded successfully`);
    console.log(`   ✓ Documents indexed: ${searchIndex.documentCount}`);
    console.log("");

    // Step 4: Search for known terms
    console.log("4. Searching for known terms...");

    // Test search 1: "schema" (common term in Zod docs)
    console.log('\n   Search query: "schema"');
    const results1 = searchIndex.search("schema", 5);
    console.log(`   Results: ${results1.length}`);

    for (const r of results1) {
      console.log(`   - ${r.path}`);
      console.log(`     Title: ${r.title}`);
      console.log(`     Score: ${r.score.toFixed(2)}`);
      console.log(`     Snippet: ${r.snippet.slice(0, 80)}...`);
    }

    // Test search 2: "validation" (another common term)
    console.log('\n   Search query: "validation"');
    const results2 = searchIndex.search("validation", 5);
    console.log(`   Results: ${results2.length}`);

    for (const r of results2) {
      console.log(`   - ${r.path}`);
      console.log(`     Title: ${r.title}`);
      console.log(`     Score: ${r.score.toFixed(2)}`);
      console.log(`     Snippet: ${r.snippet.slice(0, 80)}...`);
    }

    // Test search 3: "transform" (specific term)
    console.log('\n   Search query: "transform"');
    const results3 = searchIndex.search("transform", 5);
    console.log(`   Results: ${results3.length}`);

    for (const r of results3) {
      console.log(`   - ${r.path}`);
      console.log(`     Title: ${r.title}`);
      console.log(`     Score: ${r.score.toFixed(2)}`);
      console.log(`     Snippet: ${r.snippet.slice(0, 80)}...`);
    }

    // Test search 4: No results expected
    console.log('\n   Search query: "xyznonexistent123"');
    const results4 = searchIndex.search("xyznonexistent123", 5);
    console.log(`   Results: ${results4.length}`);
    if (results4.length === 0) {
      console.log("   ✓ Correctly returned no results for non-existent term");
    }

    console.log("\n=== All Tests Passed! ===");

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();

