/**
 * Test script for GitHub fetcher - tree structure.
 * Run with: npx tsx scripts/test-github-fetcher.ts
 */

import {
  fetchRepoTree,
  getRateLimitStatus,
  getRateLimitInfo,
  isAuthenticated,
} from "../src/services/github-fetcher.js";

function printTree(
  nodes: { name: string; path: string; type: string; children?: any[] }[],
  indent = 0
): void {
  const prefix = "  ".repeat(indent);
  for (const node of nodes) {
    const icon = node.type === "folder" ? "📁" : "📄";
    console.log(`${prefix}${icon} ${node.name}`);
    if (node.children) {
      printTree(node.children, indent + 1);
    }
  }
}

async function main() {
  console.log("🧪 Testing GitHub Fetcher - Tree Structure\n");

  // Show auth status
  if (isAuthenticated()) {
    console.log("🔑 Using GITHUB_TOKEN (5000 requests/hour)\n");
  } else {
    console.log("⚠️  No GITHUB_TOKEN set (60 requests/hour limit)\n");
  }

  try {
    // Test with a small, well-known repo
    const repoName = "colinhacks/zod";
    console.log(`1️⃣ Fetching tree from ${repoName}...\n`);

    const result = await fetchRepoTree(repoName, {
      // Focus on docs folder if it exists, or just get markdown files
      extensions: [".md", ".mdx"],
      maxDepth: 3,
    });

    console.log(`Repository: ${result.repo}`);
    console.log(`Branch: ${result.branch}`);
    console.log(`Total files: ${result.fileCount}`);
    console.log(`Total size: ${(result.totalSize / 1024).toFixed(2)} KB\n`);

    console.log("📂 Tree structure:");
    printTree(result.tree);

    // Verify expected files
    console.log("\n2️⃣ Verifying expected files...");
    const hasReadme = result.tree.some((node) => node.name === "README.md");
    console.log(`   README.md found: ${hasReadme ? "✅" : "❌"}`);

    // Check rate limit
    console.log("\n3️⃣ Rate limit status:");
    console.log(`   ${getRateLimitStatus()}`);

    const rateLimitInfo = getRateLimitInfo();
    if (rateLimitInfo) {
      console.log(
        `   Remaining: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`
      );
      console.log(
        `   Reset: ${new Date(rateLimitInfo.reset * 1000).toLocaleTimeString()}`
      );
    }

    console.log("\n✅ GitHub fetcher test passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
