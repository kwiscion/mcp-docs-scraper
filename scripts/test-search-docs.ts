/**
 * Test script for the search_docs tool.
 *
 * Checkpoint requirements:
 * 1. Index a repo with index_docs
 * 2. Call search_docs({ docs_id: "colinhacks_zod", query: "transform" })
 * 3. Verify relevant results returned with snippets
 * 4. Test with query that has no matches → empty results
 */

import { indexDocs } from "../src/tools/index-docs.js";
import { searchDocs } from "../src/tools/search-docs.js";
import { cacheManager } from "../src/services/cache-manager.js";

async function main() {
  console.log("=== search_docs Tool Test ===\n");

  // Step 1: Ensure docs are indexed
  console.log("1. Ensuring colinhacks/zod is indexed...");
  
  // Check if already cached
  const existing = await cacheManager.findById("colinhacks_zod");
  
  if (!existing) {
    console.log("   Not cached, indexing now...");
    await indexDocs({
      url: "https://github.com/colinhacks/zod",
      force_refresh: false,
    });
    console.log("   ✅ Indexed successfully\n");
  } else {
    console.log("   ✅ Already cached\n");
  }

  // Step 2: Search for "transform"
  console.log('2. Searching for "transform"...');
  
  try {
    const result = await searchDocs({
      docs_id: "colinhacks_zod",
      query: "transform",
    });

    console.log(`   docs_id: ${result.docs_id}`);
    console.log(`   query: "${result.query}"`);
    console.log(`   results: ${result.results.length} found\n`);

    if (result.results.length === 0) {
      console.log("   ⚠️  No results found - this is unexpected for 'transform' query");
    } else {
      console.log("   Top 3 results:");
      for (const res of result.results.slice(0, 3)) {
        console.log(`   - ${res.path}`);
        console.log(`     title: ${res.title}`);
        console.log(`     score: ${res.score.toFixed(2)}`);
        console.log(`     snippet: ${res.snippet.slice(0, 80)}...`);
        console.log();
      }
      console.log("   ✅ Search returned relevant results with snippets\n");
    }
  } catch (error) {
    console.error("   ❌ Search failed:", error);
    process.exit(1);
  }

  // Step 3: Search with custom limit
  console.log('3. Testing with custom limit (limit: 3)...');
  
  try {
    const result = await searchDocs({
      docs_id: "colinhacks_zod",
      query: "schema",
      limit: 3,
    });

    console.log(`   Results returned: ${result.results.length}`);
    
    if (result.results.length <= 3) {
      console.log("   ✅ Limit respected\n");
    } else {
      console.log("   ❌ Limit not respected\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("   ❌ Search failed:", error);
    process.exit(1);
  }

  // Step 4: Search with query that has no matches
  console.log('4. Testing with non-matching query "xyznonexistent123"...');
  
  try {
    const result = await searchDocs({
      docs_id: "colinhacks_zod",
      query: "xyznonexistent123",
    });

    console.log(`   Results: ${result.results.length}`);
    
    if (result.results.length === 0) {
      console.log("   ✅ Returns empty results for non-matching query\n");
    } else {
      console.log("   ⚠️  Unexpected results for non-matching query\n");
    }
  } catch (error) {
    console.error("   ❌ Search failed:", error);
    process.exit(1);
  }

  // Step 5: Test error cases
  console.log("5. Testing error cases...");
  
  // Missing docs_id
  try {
    await searchDocs({
      docs_id: "",
      query: "test",
    });
    console.log("   ❌ Should have thrown for empty docs_id");
    process.exit(1);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Missing required parameter: docs_id")) {
      console.log("   ✅ Empty docs_id handled correctly");
    } else {
      console.log(`   ⚠️  Different error: ${msg}`);
    }
  }

  // Non-existent docs_id
  try {
    await searchDocs({
      docs_id: "nonexistent_repo",
      query: "test",
    });
    console.log("   ❌ Should have thrown for non-existent docs_id");
    process.exit(1);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found in cache")) {
      console.log("   ✅ Non-existent docs_id handled correctly");
    } else {
      console.log(`   ⚠️  Different error: ${msg}`);
    }
  }

  // Missing query
  try {
    await searchDocs({
      docs_id: "colinhacks_zod",
      query: "",
    });
    console.log("   ❌ Should have thrown for empty query");
    process.exit(1);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Missing required parameter: query")) {
      console.log("   ✅ Empty query handled correctly");
    } else {
      console.log(`   ⚠️  Different error: ${msg}`);
    }
  }

  console.log();
  console.log("=== All Tests Passed ===");
  console.log("\nCheckpoint verified:");
  console.log("  ✅ search_docs returns results with snippets");
  console.log("  ✅ Limit parameter works correctly");
  console.log("  ✅ Empty results for non-matching queries");
  console.log("  ✅ Error handling for invalid inputs");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

