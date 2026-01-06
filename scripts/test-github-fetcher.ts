/**
 * Test script for GitHub fetcher - tree structure and content download.
 * Run with: npx tsx scripts/test-github-fetcher.ts
 */

import {
  fetchRepoTree,
  fetchFileContent,
  fetchMultipleFiles,
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

    // Test content download - README.md
    console.log("\n3️⃣ Testing content download (README.md)...");
    const readmeContent = await fetchFileContent(
      result.repo,
      result.branch,
      "README.md"
    );

    if (readmeContent) {
      console.log(`   ✅ README.md downloaded (${readmeContent.size} bytes)`);
      console.log(`   First 500 characters:\n`);
      console.log("   ---");
      const preview = readmeContent.content.substring(0, 500);
      console.log(
        preview
          .split("\n")
          .map((line) => `   ${line}`)
          .join("\n")
      );
      console.log("   ---\n");

      // Verify it's markdown content
      const hasMarkdownFeatures =
        readmeContent.content.includes("#") ||
        readmeContent.content.includes("```") ||
        readmeContent.content.includes("[");
      console.log(
        `   Markdown content detected: ${
          hasMarkdownFeatures ? "✅" : "⚠️ (might be plain text)"
        }`
      );
    } else {
      console.log("   ❌ README.md not found");
    }

    // Test content download - subdirectory file
    console.log("\n4️⃣ Testing subdirectory content download...");

    // Find a file in a subdirectory from the tree
    let subdirFile: string | null = null;
    const findSubdirFile = (
      nodes: { name: string; path: string; type: string; children?: any[] }[]
    ): void => {
      for (const node of nodes) {
        if (node.type === "file" && node.path.includes("/")) {
          subdirFile = node.path;
          return;
        }
        if (node.children) {
          findSubdirFile(node.children);
          if (subdirFile) return;
        }
      }
    };
    findSubdirFile(result.tree);

    if (subdirFile) {
      console.log(`   Found subdirectory file: ${subdirFile}`);
      const subdirContent = await fetchFileContent(
        result.repo,
        result.branch,
        subdirFile
      );

      if (subdirContent) {
        console.log(
          `   ✅ Downloaded successfully (${subdirContent.size} bytes)`
        );
        console.log(
          `   Preview: ${subdirContent.content
            .substring(0, 100)
            .replace(/\n/g, " ")}...`
        );
      } else {
        console.log("   ❌ File not found");
      }
    } else {
      console.log("   ⚠️ No subdirectory files found in tree");
    }

    // Test 404 handling
    console.log("\n5️⃣ Testing 404 handling...");
    const missingFile = await fetchFileContent(
      result.repo,
      result.branch,
      "this-file-definitely-does-not-exist.md"
    );
    console.log(
      `   Non-existent file returns null: ${missingFile === null ? "✅" : "❌"}`
    );

    // Test batch download
    console.log("\n6️⃣ Testing batch download...");
    const batchResult = await fetchMultipleFiles(result.repo, result.branch, [
      "README.md",
      "non-existent-file.md",
      "CONTRIBUTING.md",
    ]);
    console.log(`   Files found: ${batchResult.files.length}`);
    console.log(`   Files not found: ${batchResult.notFound.length}`);
    console.log(`   Found: ${batchResult.files.map((f) => f.path).join(", ")}`);
    console.log(`   Not found: ${batchResult.notFound.join(", ")}`);

    // Check rate limit
    console.log("\n7️⃣ Rate limit status:");
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
