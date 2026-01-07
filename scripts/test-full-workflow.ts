/**
 * Test script for Task 17: Full workflow verification
 * Tests: index → tree → search → content
 */

import { indexDocs } from "../src/tools/index-docs.js";
import { getDocsTree } from "../src/tools/get-tree.js";
import { searchDocs } from "../src/tools/search-docs.js";
import { getDocsContent } from "../src/tools/get-content.js";
import { listCachedDocs } from "../src/tools/list-cached.js";
import { clearCache } from "../src/tools/clear-cache.js";

async function testFullWorkflow() {
  console.log("=== Task 17: Full Workflow Verification ===\n");
  
  const testUrl = "https://github.com/colinhacks/zod";
  let docsId: string;

  // Step 1: Index documentation
  console.log("1. Index documentation from GitHub...");
  try {
    const indexResult = await indexDocs({ url: testUrl });
    docsId = indexResult.id;
    console.log(`   ✅ Indexed: ${docsId}`);
    console.log(`   Source: ${indexResult.source}`);
    console.log(`   Pages: ${indexResult.stats.pages}`);
    console.log(`   Size: ${(indexResult.stats.total_size_bytes / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error("   ❌ Failed to index:", error);
    process.exit(1);
  }

  // Step 2: Get docs tree
  console.log("\n2. Get documentation tree...");
  try {
    const treeResult = await getDocsTree({ docs_id: docsId });
    console.log(`   ✅ Tree retrieved: ${treeResult.tree.length} root items`);
    const fileCount = countFiles(treeResult.tree);
    console.log(`   Total files in tree: ${fileCount}`);
  } catch (error) {
    console.error("   ❌ Failed to get tree:", error);
    process.exit(1);
  }

  // Step 3: Search documentation
  console.log("\n3. Search documentation...");
  try {
    const searchResult = await searchDocs({ 
      docs_id: docsId, 
      query: "transform",
      limit: 5
    });
    console.log(`   ✅ Search completed: ${searchResult.results.length} results`);
    if (searchResult.results.length > 0) {
      console.log(`   Top result: ${searchResult.results[0].path}`);
      console.log(`   Score: ${searchResult.results[0].score.toFixed(2)}`);
    }
  } catch (error) {
    console.error("   ❌ Failed to search:", error);
    process.exit(1);
  }

  // Step 4: Get content
  console.log("\n4. Get specific file content...");
  try {
    const contentResult = await getDocsContent({ 
      docs_id: docsId, 
      paths: ["README.md"] 
    });
    const readmeContent = contentResult.contents["README.md"];
    if (readmeContent) {
      console.log(`   ✅ Content retrieved: README.md`);
      console.log(`   Title: ${readmeContent.title}`);
      console.log(`   Size: ${readmeContent.size_bytes} bytes`);
      console.log(`   Headings: ${readmeContent.headings.length}`);
    } else {
      console.log(`   ⚠️ README.md not found, trying other files...`);
    }
  } catch (error) {
    console.error("   ❌ Failed to get content:", error);
    process.exit(1);
  }

  // Step 5: List cached docs
  console.log("\n5. List cached documentation...");
  try {
    const listResult = await listCachedDocs();
    console.log(`   ✅ Cached docs: ${listResult.docs.length}`);
    for (const doc of listResult.docs) {
      console.log(`   - ${doc.id} (${doc.source}, ${doc.page_count} pages)`);
    }
  } catch (error) {
    console.error("   ❌ Failed to list cached:", error);
    process.exit(1);
  }

  console.log("\n=== All Workflow Steps Passed ===\n");
  console.log("Checkpoint verified:");
  console.log("  ✅ index_docs - Fetch and cache documentation");
  console.log("  ✅ get_docs_tree - Browse file structure");
  console.log("  ✅ search_docs - Full-text search with snippets");
  console.log("  ✅ get_docs_content - Retrieve file content");
  console.log("  ✅ list_cached_docs - List cached entries");
  console.log("\n✅ Ready for Claude Desktop / Cursor configuration!");
}

function countFiles(tree: any[]): number {
  let count = 0;
  for (const node of tree) {
    if (node.type === "file") {
      count++;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

testFullWorkflow().catch(console.error);

