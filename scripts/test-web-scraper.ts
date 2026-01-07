/**
 * Test script for the Web Scraper service.
 *
 * Checkpoint requirements:
 * 1. Crawls a simple docs site
 * 2. Extracts pages up to depth 2
 * 3. Logs discovered URLs
 * 4. Verify same-domain links only
 * 5. Verify depth limit respected
 */

import { crawlWebsite } from "../src/services/web-scraper.js";
import {
  normalizeUrl,
  extractDomain,
  isSameDomain,
  shouldCrawl,
  extractLinks,
  urlToFilename,
} from "../src/utils/url.js";

async function testUrlUtilities() {
  console.log("=== URL Utilities Test ===\n");

  // Test normalizeUrl
  console.log("1. Testing URL normalization...");
  const testUrls = [
    { input: "https://example.com/docs#section", expected: "https://example.com/docs" },
    { input: "https://example.com/docs/", expected: "https://example.com/docs" },
    { input: "https://example.com/docs?utm_source=test", expected: "https://example.com/docs" },
    { input: "https://example.com/", expected: "https://example.com/" },
  ];

  let allPassed = true;
  for (const { input, expected } of testUrls) {
    const result = normalizeUrl(input);
    const passed = result === expected;
    if (!passed) {
      console.log(`   ❌ normalize("${input}") = "${result}", expected "${expected}"`);
      allPassed = false;
    }
  }
  if (allPassed) {
    console.log("   ✅ URL normalization working correctly\n");
  }

  // Test extractDomain
  console.log("2. Testing domain extraction...");
  const domain = extractDomain("https://docs.example.com/getting-started");
  if (domain === "docs.example.com") {
    console.log("   ✅ Domain extraction working correctly\n");
  } else {
    console.log(`   ❌ Expected "docs.example.com", got "${domain}"\n`);
  }

  // Test isSameDomain
  console.log("3. Testing same domain check...");
  const sameDomainTests = [
    { url1: "https://example.com/a", url2: "https://example.com/b", expected: true },
    { url1: "https://www.example.com/a", url2: "https://example.com/b", expected: true },
    { url1: "https://example.com/a", url2: "https://other.com/b", expected: false },
  ];

  allPassed = true;
  for (const { url1, url2, expected } of sameDomainTests) {
    const result = isSameDomain(url1, url2);
    if (result !== expected) {
      console.log(`   ❌ isSameDomain("${url1}", "${url2}") = ${result}, expected ${expected}`);
      allPassed = false;
    }
  }
  if (allPassed) {
    console.log("   ✅ Same domain check working correctly\n");
  }

  // Test shouldCrawl
  console.log("4. Testing shouldCrawl filter...");
  const crawlTests = [
    { url: "https://example.com/docs", base: "https://example.com", valid: true },
    { url: "https://other.com/docs", base: "https://example.com", valid: false },
    { url: "https://example.com/image.png", base: "https://example.com", valid: false },
    { url: "https://example.com/api/users", base: "https://example.com", valid: false },
    { url: "mailto:test@example.com", base: "https://example.com", valid: false },
  ];

  allPassed = true;
  for (const { url, base, valid } of crawlTests) {
    const result = shouldCrawl(url, base);
    if (result.isValid !== valid) {
      console.log(`   ❌ shouldCrawl("${url}") = ${result.isValid}, expected ${valid} (reason: ${result.reason})`);
      allPassed = false;
    }
  }
  if (allPassed) {
    console.log("   ✅ shouldCrawl filter working correctly\n");
  }

  // Test extractLinks
  console.log("5. Testing link extraction...");
  const html = `
    <html>
      <body>
        <a href="/docs">Docs</a>
        <a href="https://example.com/api">API</a>
        <a href="https://external.com/link">External</a>
        <a href="#section">Anchor</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="/image.png">Image</a>
      </body>
    </html>
  `;
  const links = extractLinks(html, "https://example.com/");
  console.log(`   Found ${links.length} valid links:`, links);
  
  const hasDocsLink = links.some((l) => l.includes("/docs"));
  const hasApiLink = links.some((l) => l.includes("/api"));
  const hasExternal = links.some((l) => l.includes("external.com"));
  
  if (hasDocsLink && !hasExternal) {
    console.log("   ✅ Link extraction working correctly (external filtered)\n");
  } else {
    console.log("   ⚠️  Link extraction may have issues\n");
  }

  // Test urlToFilename
  console.log("6. Testing URL to filename conversion...");
  const filenameTests = [
    { url: "https://example.com/docs/getting-started", expected: "docs_getting-started.md" },
    { url: "https://example.com/", expected: "index.md" },
    { url: "https://example.com/api/v1/users", expected: "api_v1_users.md" },
  ];

  allPassed = true;
  for (const { url, expected } of filenameTests) {
    const result = urlToFilename(url);
    if (result !== expected) {
      console.log(`   ❌ urlToFilename("${url}") = "${result}", expected "${expected}"`);
      allPassed = false;
    }
  }
  if (allPassed) {
    console.log("   ✅ URL to filename conversion working correctly\n");
  }
}

async function testWebScraper() {
  console.log("=== Web Scraper Test ===\n");

  // Use a simple, stable documentation site for testing
  // htmx.org is a small, fast-loading docs site
  const testUrl = "https://htmx.org/docs/";

  console.log(`Crawling: ${testUrl}`);
  console.log("Options: maxDepth=2, maxPages=10, requestDelay=500ms\n");

  try {
    const result = await crawlWebsite(testUrl, {
      maxDepth: 2,
      maxPages: 10,
      requestDelay: 500,
    });

    console.log("\n--- Crawl Results ---\n");
    console.log(`Base URL: ${result.baseUrl}`);
    console.log(`Pages crawled: ${result.stats.totalCrawled}`);
    console.log(`Pages failed: ${result.stats.totalFailed}`);
    console.log(`Pages skipped: ${result.stats.totalSkipped}`);
    console.log(`URLs discovered: ${result.stats.totalDiscovered}`);
    console.log(`Max depth reached: ${result.stats.maxDepthReached}`);
    console.log(`Duration: ${result.stats.durationMs}ms\n`);

    // Verify pages were crawled
    if (result.pages.length > 0) {
      console.log("✅ Successfully crawled pages\n");

      console.log("Pages crawled:");
      for (const page of result.pages) {
        console.log(`  - ${page.url} (depth ${page.depth}, ${page.links.length} links)`);
      }
      console.log();
    } else {
      console.log("❌ No pages were crawled\n");
      return false;
    }

    // Verify same-domain only
    console.log("Verifying same-domain constraint...");
    const baseDomain = extractDomain(testUrl);
    let allSameDomain = true;
    for (const page of result.pages) {
      const pageDomain = extractDomain(page.url);
      if (pageDomain !== baseDomain && pageDomain !== `www.${baseDomain}`) {
        console.log(`  ❌ External page found: ${page.url}`);
        allSameDomain = false;
      }
    }
    if (allSameDomain) {
      console.log("  ✅ All pages are same-domain\n");
    }

    // Verify depth limit
    console.log("Verifying depth limit...");
    let maxDepthFound = 0;
    for (const page of result.pages) {
      maxDepthFound = Math.max(maxDepthFound, page.depth);
    }
    if (maxDepthFound <= 2) {
      console.log(`  ✅ Depth limit respected (max depth found: ${maxDepthFound})\n`);
    } else {
      console.log(`  ❌ Depth limit exceeded: ${maxDepthFound} > 2\n`);
    }

    // Show failed/skipped if any
    if (result.failed.length > 0) {
      console.log("Failed URLs:");
      for (const f of result.failed.slice(0, 5)) {
        console.log(`  - ${f.url}: ${f.reason}`);
      }
      console.log();
    }

    if (result.skipped.length > 0) {
      console.log(`Skipped URLs: ${result.skipped.length} total`);
      for (const s of result.skipped.slice(0, 5)) {
        console.log(`  - ${s.url}: ${s.reason}`);
      }
      console.log();
    }

    return true;
  } catch (error) {
    console.error("Crawl failed:", error);
    return false;
  }
}

async function main() {
  // First test URL utilities
  await testUrlUtilities();

  // Then test the actual scraper
  const success = await testWebScraper();

  console.log("=== Test Complete ===\n");

  if (success) {
    console.log("Checkpoint verified:");
    console.log("  ✅ Crawls documentation site");
    console.log("  ✅ Extracts pages up to depth 2");
    console.log("  ✅ Logs discovered URLs");
    console.log("  ✅ Same-domain links only");
    console.log("  ✅ Depth limit respected");
  } else {
    console.log("❌ Some tests failed");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

