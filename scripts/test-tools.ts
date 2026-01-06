/**
 * Test script that directly tests list_cached_docs and clear_cache tools.
 * Run with: npx tsx scripts/test-tools.ts
 */

import { listCachedDocs } from "../src/tools/list-cached.js";
import { clearCache } from "../src/tools/clear-cache.js";

async function main() {
  console.log("🧪 Testing MCP Tools\n");

  // Step 1: List cached docs - should show the fake entry
  console.log("1️⃣ Calling list_cached_docs...");
  const listResult1 = await listCachedDocs();
  console.log("   Result:", JSON.stringify(listResult1, null, 2));
  
  if (listResult1.docs.length === 0) {
    console.log("   ⚠️ No entries found. Run scripts/create-test-cache.ts first.\n");
  } else {
    console.log(`   ✅ Found ${listResult1.docs.length} cached entry(ies)\n`);
  }

  // Step 2: Clear cache with all: true
  console.log("2️⃣ Calling clear_cache({ all: true })...");
  const clearResult = await clearCache({ all: true });
  console.log("   Result:", JSON.stringify(clearResult, null, 2));
  console.log(`   ✅ Cleared ${clearResult.cleared.length} entries, ${clearResult.remaining} remaining\n`);

  // Step 3: List cached docs again - should be empty
  console.log("3️⃣ Calling list_cached_docs again...");
  const listResult2 = await listCachedDocs();
  console.log("   Result:", JSON.stringify(listResult2, null, 2));
  
  if (listResult2.docs.length === 0) {
    console.log("   ✅ Cache is now empty\n");
  } else {
    console.log(`   ❌ Expected empty, but found ${listResult2.docs.length} entries\n`);
  }

  console.log("✅ Tool tests complete!");
}

main().catch(console.error);

