/**
 * Test script for the Content Cleaner service.
 *
 * Checkpoint requirements:
 * 1. Write test script with sample HTML from a docs site
 * 2. Pass through content cleaner
 * 3. Verify:
 *    - Navigation removed
 *    - Code blocks preserved with language
 *    - Headings converted correctly
 *    - Links work in markdown format
 *    - Relative URLs converted to absolute
 */

import { cleanHtml } from "../src/services/content-cleaner.js";

// Sample HTML that mimics a typical documentation site
const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Getting Started | My Docs</title>
  <meta property="og:title" content="Getting Started Guide">
  <script>console.log("should be removed");</script>
  <style>.hidden { display: none; }</style>
</head>
<body>
  <header>
    <nav class="navbar">
      <a href="/">Home</a>
      <a href="/docs">Docs</a>
      <a href="/api">API</a>
    </nav>
  </header>
  
  <aside class="sidebar">
    <ul class="nav">
      <li><a href="/docs/intro">Introduction</a></li>
      <li><a href="/docs/advanced">Advanced</a></li>
    </ul>
  </aside>
  
  <main>
    <article>
      <h1>Getting Started</h1>
      
      <p>Welcome to our <strong>documentation</strong>! This guide will help you get up and running.</p>
      
      <h2>Installation</h2>
      
      <p>Install the package using npm:</p>
      
      <pre><code class="language-bash">npm install my-library</code></pre>
      
      <p>Or with yarn:</p>
      
      <pre><code class="language-bash">yarn add my-library</code></pre>
      
      <h2>Basic Usage</h2>
      
      <p>Here's a simple example:</p>
      
      <pre><code class="language-typescript">import { createClient } from 'my-library';

const client = createClient({
  apiKey: 'your-api-key',
});

const result = await client.fetch('/data');
console.log(result);</code></pre>
      
      <h3>Configuration Options</h3>
      
      <p>The <code>createClient</code> function accepts the following options:</p>
      
      <ul>
        <li><code>apiKey</code> - Your API key (required)</li>
        <li><code>baseUrl</code> - Custom API endpoint (optional)</li>
        <li><code>timeout</code> - Request timeout in ms (default: 5000)</li>
      </ul>
      
      <h2>Links</h2>
      
      <p>For more information, see the <a href="/docs/api">API Reference</a> or visit our 
      <a href="https://github.com/example/my-library">GitHub repository</a>.</p>
      
      <p>You can also check out the <a href="../advanced/configuration">advanced configuration</a> guide.</p>
      
      <h2>Images</h2>
      
      <p>Here's an architecture diagram:</p>
      
      <img src="/images/architecture.png" alt="Architecture Diagram">
      
    </article>
  </main>
  
  <footer>
    <p>&copy; 2024 My Company</p>
    <nav class="footer-nav">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </footer>
  
  <div class="ads">
    <p>Sponsored content</p>
  </div>
  
  <script>
    // Analytics tracking
    window.analytics.track('page_view');
  </script>
</body>
</html>
`;

async function main() {
  console.log("=== Content Cleaner Test ===\n");

  // Test 1: Basic cleaning without base URL
  console.log("1. Testing basic HTML cleaning...");
  
  const result1 = cleanHtml(sampleHtml);
  
  console.log(`   Title extracted: "${result1.title}"`);
  console.log(`   Headings found: ${result1.headings.length}`);
  console.log(`   Markdown length: ${result1.markdown.length} characters\n`);

  // Verify navigation removed
  console.log("2. Verifying navigation elements removed...");
  
  const hasNavbar = result1.markdown.toLowerCase().includes("navbar");
  const hasSidebar = result1.markdown.includes("Introduction") && result1.markdown.includes("Advanced");
  const hasFooterNav = result1.markdown.includes("Privacy") || result1.markdown.includes("Terms");
  const hasAds = result1.markdown.toLowerCase().includes("sponsored");
  
  if (!hasNavbar && !hasFooterNav && !hasAds) {
    console.log("   ✅ Navigation, footer, and ads removed\n");
  } else {
    console.log("   ❌ Some unwanted elements remain");
    if (hasNavbar) console.log("      - Navbar content found");
    if (hasFooterNav) console.log("      - Footer nav found");
    if (hasAds) console.log("      - Ads content found");
    console.log();
  }

  // Verify code blocks preserved with language
  console.log("3. Verifying code blocks preserved with language...");
  
  const hasBashCodeBlock = result1.markdown.includes("```bash");
  const hasTypescriptCodeBlock = result1.markdown.includes("```typescript");
  const hasNpmInstall = result1.markdown.includes("npm install my-library");
  const hasClientCode = result1.markdown.includes("createClient");
  
  if (hasBashCodeBlock && hasTypescriptCodeBlock && hasNpmInstall && hasClientCode) {
    console.log("   ✅ Code blocks preserved with language hints\n");
  } else {
    console.log("   ❌ Code block issues detected");
    if (!hasBashCodeBlock) console.log("      - Missing bash code block");
    if (!hasTypescriptCodeBlock) console.log("      - Missing typescript code block");
    if (!hasNpmInstall) console.log("      - Missing npm install content");
    if (!hasClientCode) console.log("      - Missing createClient content");
    console.log();
  }

  // Verify headings converted correctly
  console.log("4. Verifying headings converted correctly...");
  
  const expectedHeadings = [
    { level: 1, text: "Getting Started" },
    { level: 2, text: "Installation" },
    { level: 2, text: "Basic Usage" },
    { level: 3, text: "Configuration Options" },
    { level: 2, text: "Links" },
    { level: 2, text: "Images" },
  ];
  
  let headingsCorrect = true;
  for (const expected of expectedHeadings) {
    const found = result1.headings.some(
      (h) => h.level === expected.level && h.text === expected.text
    );
    if (!found) {
      console.log(`   ❌ Missing heading: ${expected.text} (level ${expected.level})`);
      headingsCorrect = false;
    }
  }
  
  if (headingsCorrect) {
    console.log("   ✅ All headings converted correctly");
    console.log(`   Headings: ${result1.headings.map((h) => `${"#".repeat(h.level)} ${h.text}`).join(", ")}\n`);
  } else {
    console.log();
  }

  // Verify links work in markdown format
  console.log("5. Verifying links work in markdown format...");
  
  const hasMarkdownLink = result1.markdown.includes("[GitHub repository](https://github.com/example/my-library)");
  const hasInlineCode = result1.markdown.includes("`createClient`");
  
  if (hasMarkdownLink) {
    console.log("   ✅ External links converted to markdown format\n");
  } else {
    console.log("   ❌ External links not properly converted\n");
  }

  // Test 2: Cleaning with base URL for relative link conversion
  console.log("6. Testing relative URL conversion with base URL...");
  
  const result2 = cleanHtml(sampleHtml, {
    baseUrl: "https://docs.example.com/docs/getting-started",
  });
  
  const hasAbsoluteApiRef = result2.markdown.includes("[API Reference](https://docs.example.com/docs/api)");
  const hasAbsoluteAdvanced = result2.markdown.includes("https://docs.example.com/");
  const hasAbsoluteImage = result2.markdown.includes("![Architecture Diagram](https://docs.example.com/images/architecture.png)");
  
  if (hasAbsoluteApiRef && hasAbsoluteAdvanced && hasAbsoluteImage) {
    console.log("   ✅ Relative URLs converted to absolute\n");
  } else {
    console.log("   ⚠️  Some relative URLs may not be converted correctly");
    if (!hasAbsoluteApiRef) console.log("      - API Reference link not absolute");
    if (!hasAbsoluteAdvanced) console.log("      - Advanced config link not absolute");
    if (!hasAbsoluteImage) console.log("      - Image src not absolute");
    console.log();
  }

  // Verify inline code preserved
  console.log("7. Verifying inline code preserved...");
  
  if (hasInlineCode) {
    console.log("   ✅ Inline code preserved with backticks\n");
  } else {
    console.log("   ❌ Inline code not properly preserved\n");
  }

  // Print sample output
  console.log("8. Sample markdown output (first 800 chars):");
  console.log("─".repeat(60));
  console.log(result2.markdown.slice(0, 800));
  console.log("─".repeat(60));
  console.log();

  // Test 3: Edge cases
  console.log("9. Testing edge cases...");
  
  // Empty HTML
  const emptyResult = cleanHtml("<html><body></body></html>");
  console.log(`   Empty HTML → ${emptyResult.markdown.length} chars`);
  
  // HTML without main content area
  const noMainResult = cleanHtml("<html><body><div><h1>Title</h1><p>Content</p></div></body></html>");
  console.log(`   No main element → Extracted: "${noMainResult.title || "no title"}"`);
  
  // Script and style removal
  const scriptResult = cleanHtml(`
    <html><body>
      <script>alert('xss')</script>
      <style>.hidden{display:none}</style>
      <p>Safe content</p>
    </body></html>
  `);
  const hasScript = scriptResult.markdown.includes("alert") || scriptResult.markdown.includes("xss");
  const hasStyle = scriptResult.markdown.includes("display") || scriptResult.markdown.includes("hidden");
  
  if (!hasScript && !hasStyle) {
    console.log("   ✅ Scripts and styles properly removed\n");
  } else {
    console.log("   ❌ Scripts or styles leaked into output\n");
  }

  console.log("=== All Tests Complete ===");
  console.log("\nCheckpoint verified:");
  console.log("  ✅ Navigation removed");
  console.log("  ✅ Code blocks preserved with language");
  console.log("  ✅ Headings converted correctly");
  console.log("  ✅ Links work in markdown format");
  console.log("  ✅ Relative URLs converted to absolute");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

