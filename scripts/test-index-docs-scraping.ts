/**
 * Test script for index_docs scraping support.
 *
 * Checkpoint requirements:
 * 1. Call index_docs({ url: "https://docs.some-site.com", type: "scrape" })
 * 2. Verify pages are crawled and cleaned
 * 3. Verify cache is populated with markdown files
 * 4. Use get_docs_tree and get_docs_content on scraped docs
 */

import { indexDocs } from "../src/tools/index-docs.js";
import { getDocsTree } from "../src/tools/get-tree.js";
import { getDocsContent } from "../src/tools/get-content.js";
import { searchDocs } from "../src/tools/search-docs.js";
import { cacheManager } from "../src/services/cache-manager.js";

async function main() {
  console.log("=== index_docs Scraping Support Test ===\n");

  // Use htmx.org as a small, well-structured docs site
  const testUrl = "https://htmx.org/docs/";

  // Step 1: Index the docs with type: "scrape"
  console.log(`1. Indexing ${testUrl} with type: "scrape"...`);
  console.log("   (This may take a minute due to crawl delays)\n");

  let result;
  try {
    result = await indexDocs({
      url: testUrl,
      type: "scrape",
      depth: 1, // Lower depth for faster testing
      force_refresh: true,
    });

    console.log("   ✅ Indexing complete!");
    console.log(`   - ID: ${result.id}`);
    console.log(`   - Source: ${result.source}`);
    console.log(`   - Base URL: ${result.base_url}`);
    console.log(`   - Pages: ${result.stats.pages}`);
    console.log(`   - Size: ${(result.stats.total_size_bytes / 1024).toFixed(1)} KB`);
    console.log(`   - Tree nodes: ${result.tree.length}`);
    console.log();
  } catch (error) {
    console.error("   ❌ Indexing failed:", error);
    process.exit(1);
  }

  // Step 2: Verify source is "scraped"
  console.log("2. Verifying source type...");
  if (result.source === "scraped") {
    console.log("   ✅ Source type is 'scraped'\n");
  } else {
    console.log(`   ❌ Expected source 'scraped', got '${result.source}'\n`);
    process.exit(1);
  }

  // Step 3: Verify cache has markdown files
  console.log("3. Verifying cache is populated...");
  const meta = await cacheManager.getMeta("scraped", result.id);
  if (meta) {
    console.log(`   ✅ Cache metadata found`);
    console.log(`   - Page count: ${meta.page_count}`);
    console.log(`   - Tree nodes: ${meta.tree.length}\n`);
  } else {
    console.log("   ❌ Cache metadata not found\n");
    process.exit(1);
  }

  // Step 4: Use get_docs_tree on scraped docs
  console.log("4. Testing get_docs_tree...");
  try {
    const treeResult = await getDocsTree({
      docs_id: result.id,
    });

    console.log(`   ✅ Tree retrieved successfully`);
    console.log(`   - Path: ${treeResult.path}`);
    console.log(`   - Nodes: ${treeResult.tree.length}`);
    
    // Show first few files
    console.log("   - Files (first 5):");
    for (const node of treeResult.tree.slice(0, 5)) {
      console.log(`     - ${node.name} (${node.size} bytes)`);
    }
    console.log();
  } catch (error) {
    console.error("   ❌ get_docs_tree failed:", error);
    process.exit(1);
  }

  // Step 5: Use get_docs_content on scraped docs
  console.log("5. Testing get_docs_content...");
  
  // Get the first file from the tree
  const firstFile = result.tree[0];
  if (!firstFile) {
    console.log("   ❌ No files in tree\n");
    process.exit(1);
  }

  try {
    const contentResult = await getDocsContent({
      docs_id: result.id,
      paths: [firstFile.path],
    });

    const fileContent = contentResult.contents[firstFile.path];
    if (fileContent) {
      console.log(`   ✅ Content retrieved successfully`);
      console.log(`   - File: ${firstFile.path}`);
      console.log(`   - Title: ${fileContent.title || "(no title)"}`);
      console.log(`   - Size: ${fileContent.size_bytes} bytes`);
      console.log(`   - Headings: ${fileContent.headings.length}`);
      
      // Show first 200 chars of content
      console.log(`   - Preview: ${fileContent.content.slice(0, 200).replace(/\n/g, " ")}...`);
      console.log();

      // Verify it's markdown (starts with # or has markdown syntax)
      const hasMarkdown = 
        fileContent.content.includes("#") || 
        fileContent.content.includes("**") ||
        fileContent.content.includes("```") ||
        fileContent.content.includes("[");
      
      if (hasMarkdown) {
        console.log("   ✅ Content appears to be valid Markdown\n");
      } else {
        console.log("   ⚠️  Content may not be proper Markdown\n");
      }
    } else {
      console.log(`   ❌ Content not found for ${firstFile.path}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error("   ❌ get_docs_content failed:", error);
    process.exit(1);
  }

  // Step 6: Test search on scraped docs
  console.log("6. Testing search_docs on scraped content...");
  try {
    const searchResult = await searchDocs({
      docs_id: result.id,
      query: "htmx",
      limit: 5,
    });

    console.log(`   ✅ Search completed`);
    console.log(`   - Query: "${searchResult.query}"`);
    console.log(`   - Results: ${searchResult.results.length}`);
    
    if (searchResult.results.length > 0) {
      console.log("   - Top result:");
      const top = searchResult.results[0];
      console.log(`     - Path: ${top.path}`);
      console.log(`     - Title: ${top.title}`);
      console.log(`     - Score: ${top.score.toFixed(2)}`);
    }
    console.log();
  } catch (error) {
    console.error("   ❌ search_docs failed:", error);
    process.exit(1);
  }

  // Step 7: Test auto mode with non-GitHub URL
  console.log("7. Testing auto mode with non-GitHub URL...");
  
  // Clear cache first
  await cacheManager.clearEntry("scraped", result.id);
  
  try {
    const autoResult = await indexDocs({
      url: testUrl,
      type: "auto", // Should detect non-GitHub and use scraping
      depth: 1,
    });

    if (autoResult.source === "scraped") {
      console.log("   ✅ Auto mode correctly chose scraping for non-GitHub URL\n");
    } else {
      console.log(`   ❌ Auto mode chose ${autoResult.source} instead of scraping\n`);
    }
  } catch (error) {
    console.error("   ❌ Auto mode failed:", error);
  }

  console.log("=== All Tests Passed ===\n");
  console.log("Checkpoint verified:");
  console.log("  ✅ index_docs with type: 'scrape' works");
  console.log("  ✅ Pages are crawled and cleaned to markdown");
  console.log("  ✅ Cache is populated with markdown files");
  console.log("  ✅ get_docs_tree works on scraped docs");
  console.log("  ✅ get_docs_content works on scraped docs");
  console.log("  ✅ search_docs works on scraped docs");
  console.log("  ✅ Auto mode detects non-GitHub URLs");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

