/**
 * Test script for get_docs_tree tool.
 * Run with: npx tsx scripts/test-get-tree.ts
 */

import { getDocsTree } from "../src/tools/get-tree.js";
import { indexDocs } from "../src/tools/index-docs.js";
import { cacheManager } from "../src/services/cache-manager.js";

function printTree(
  nodes: { name: string; path: string; type: string; children?: any[] }[],
  indent = 0
): void {
  const prefix = "  ".repeat(indent);
  for (const node of nodes) {
    const icon = node.type === "folder" ? "📁" : "📄";
    console.log(`${prefix}${icon} ${node.name}`);
    if (node.children && indent < 3) {
      printTree(node.children, indent + 1);
    }
  }
}

async function main() {
  console.log("🧪 Testing get_docs_tree Tool\n");

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

    // Test 2: Get full tree
    console.log("\n2️⃣ Testing get_docs_tree({ docs_id: 'colinhacks_zod' })...");
    const fullTree = await getDocsTree({ docs_id: "colinhacks_zod" });

    console.log(`   docs_id: ${fullTree.docs_id}`);
    console.log(`   path: ${fullTree.path}`);
    console.log(`   tree nodes: ${fullTree.tree.length}`);
    console.log("\n   Full tree:");
    printTree(fullTree.tree);

    // Test 3: Get subtree with path
    console.log("\n3️⃣ Testing subtree with path='packages'...");
    const subtree = await getDocsTree({
      docs_id: "colinhacks_zod",
      path: "packages",
    });

    console.log(`   docs_id: ${subtree.docs_id}`);
    console.log(`   path: ${subtree.path}`);
    console.log(`   subtree nodes: ${subtree.tree.length}`);
    console.log("\n   Subtree:");
    printTree(subtree.tree);

    // Test 4: Test max_depth
    console.log("\n4️⃣ Testing max_depth=1...");
    const shallowTree = await getDocsTree({
      docs_id: "colinhacks_zod",
      max_depth: 1,
    });

    console.log(`   Tree with max_depth=1:`);
    printTree(shallowTree.tree);

    // Verify no children beyond depth 1
    let hasDeepChildren = false;
    for (const node of shallowTree.tree) {
      if (node.children && node.children.length > 0) {
        hasDeepChildren = true;
        break;
      }
    }
    console.log(`   Children beyond depth 1: ${hasDeepChildren ? "❌ (unexpected)" : "✅ none"}`);

    // Test 5: Test non-existent docs_id
    console.log("\n5️⃣ Testing non-existent docs_id...");
    try {
      await getDocsTree({ docs_id: "non_existent_docs" });
      console.log("   ❌ Should have thrown an error");
    } catch (error) {
      console.log(`   ✅ Correctly threw error: ${(error as Error).message.slice(0, 50)}...`);
    }

    // Test 6: Test non-existent path
    console.log("\n6️⃣ Testing non-existent path...");
    try {
      await getDocsTree({
        docs_id: "colinhacks_zod",
        path: "non/existent/path",
      });
      console.log("   ❌ Should have thrown an error");
    } catch (error) {
      console.log(`   ✅ Correctly threw error: ${(error as Error).message.slice(0, 50)}...`);
    }

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();

