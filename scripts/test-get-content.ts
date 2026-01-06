/**
 * Test script for get_docs_content tool.
 * Run with: npx tsx scripts/test-get-content.ts
 */

import { getDocsContent } from "../src/tools/get-content.js";
import { indexDocs } from "../src/tools/index-docs.js";
import { cacheManager } from "../src/services/cache-manager.js";

async function main() {
  console.log("🧪 Testing get_docs_content Tool\n");

  try {
    // Ensure docs are indexed
    console.log("1️⃣ Ensuring docs are indexed...");
    await cacheManager.initialize();

    const existingDocs = await cacheManager.findById("colinhacks_zod");
    if (!existingDocs) {
      console.log("   Indexing colinhacks/zod...");
      await indexDocs({ url: "https://github.com/colinhacks/zod" });
      console.log("   ✅ Indexed");
    } else {
      console.log("   ✅ Already cached");
    }

    // Test 2: Get single file content
    console.log("\n2️⃣ Testing get_docs_content with single path (README.md)...");
    const singleResult = await getDocsContent({
      docs_id: "colinhacks_zod",
      paths: ["README.md"],
    });

    console.log(`   docs_id: ${singleResult.docs_id}`);
    console.log(`   found: ${Object.keys(singleResult.contents).length}`);
    console.log(`   not_found: ${singleResult.not_found.length}`);

    if (singleResult.contents["README.md"]) {
      const readme = singleResult.contents["README.md"];
      console.log(`\n   README.md:`);
      console.log(`     title: ${readme.title || "(no title)"}`);
      console.log(`     size: ${readme.size_bytes} bytes`);
      console.log(`     headings: ${readme.headings.length}`);
      if (readme.headings.length > 0) {
        console.log(`     first 3 headings:`);
        for (const h of readme.headings.slice(0, 3)) {
          console.log(`       - ${h}`);
        }
      }
      console.log(`     content preview: ${readme.content.substring(0, 100).replace(/\n/g, " ")}...`);
    }

    // Test 3: Get multiple files
    console.log("\n3️⃣ Testing get_docs_content with multiple paths...");
    const multiResult = await getDocsContent({
      docs_id: "colinhacks_zod",
      paths: ["README.md", "CONTRIBUTING.md", "packages/zod/README.md"],
    });

    console.log(`   docs_id: ${multiResult.docs_id}`);
    console.log(`   found: ${Object.keys(multiResult.contents).length}`);
    console.log(`   not_found: ${multiResult.not_found.length}`);
    console.log(`   paths found:`);
    for (const path of Object.keys(multiResult.contents)) {
      const file = multiResult.contents[path];
      console.log(`     - ${path} (${file.size_bytes} bytes, ${file.headings.length} headings)`);
    }

    // Test 4: Test with non-existent path
    console.log("\n4️⃣ Testing with non-existent path...");
    const notFoundResult = await getDocsContent({
      docs_id: "colinhacks_zod",
      paths: ["README.md", "non-existent-file.md", "also-missing.txt"],
    });

    console.log(`   found: ${Object.keys(notFoundResult.contents).length}`);
    console.log(`   not_found: ${notFoundResult.not_found.length}`);
    console.log(`   not_found paths: ${notFoundResult.not_found.join(", ")}`);

    const hasNotFound = notFoundResult.not_found.length === 2;
    console.log(`   ✅ Non-existent files in not_found array: ${hasNotFound ? "✅" : "❌"}`);

    // Test 5: Test with non-existent docs_id
    console.log("\n5️⃣ Testing non-existent docs_id...");
    try {
      await getDocsContent({
        docs_id: "non_existent_docs",
        paths: ["README.md"],
      });
      console.log("   ❌ Should have thrown an error");
    } catch (error) {
      console.log(`   ✅ Correctly threw error: ${(error as Error).message.slice(0, 50)}...`);
    }

    // Test 6: Test heading extraction in detail
    console.log("\n6️⃣ Testing heading extraction...");
    const contentWithHeadings = await getDocsContent({
      docs_id: "colinhacks_zod",
      paths: ["CONTRIBUTING.md"],
    });

    if (contentWithHeadings.contents["CONTRIBUTING.md"]) {
      const file = contentWithHeadings.contents["CONTRIBUTING.md"];
      console.log(`   CONTRIBUTING.md headings (${file.headings.length}):`);
      for (const heading of file.headings.slice(0, 8)) {
        console.log(`     ${heading}`);
      }
      if (file.headings.length > 8) {
        console.log(`     ... and ${file.headings.length - 8} more`);
      }
    }

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();

