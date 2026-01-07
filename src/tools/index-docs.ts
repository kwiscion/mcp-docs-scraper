/**
 * index_docs tool - Fetches and caches documentation from GitHub repositories or websites.
 */

import type { DocsTreeNode } from "../types/cache.js";
import { cacheManager } from "../services/cache-manager.js";
import {
  fetchRepoTree,
  fetchFileContent,
  type FetchTreeResult,
} from "../services/github-fetcher.js";
import {
  SearchIndex,
  createIndexableDocument,
} from "../services/search-index.js";
import { crawlWebsite } from "../services/web-scraper.js";
import { cleanHtml } from "../services/content-cleaner.js";
import { extractDomain, normalizeUrl } from "../utils/url.js";
import { detectGitHubRepo } from "../services/github-detector.js";
import {
  InvalidUrlError,
  NoContentError,
  ScrapingBlockedError,
  ValidationError,
  wrapError,
} from "../types/errors.js";

/**
 * Input parameters for index_docs tool.
 */
export interface IndexDocsInput {
  /** GitHub repo URL or docs website */
  url: string;
  /** Detection method (default: "github" for now) */
  type?: "github" | "scrape" | "auto";
  /** Crawl depth for scraping (not used for GitHub) */
  depth?: number;
  /** URL patterns to include */
  include_patterns?: string[];
  /** URL patterns to exclude */
  exclude_patterns?: string[];
  /** Ignore cache, re-fetch */
  force_refresh?: boolean;
}

/**
 * Output from index_docs tool.
 */
export interface IndexDocsOutput {
  /** Unique cache ID for this docs set */
  id: string;
  /** Source type */
  source: "github" | "scraped";
  /** Repository in "owner/repo" format (if GitHub) */
  repo?: string;
  /** Base URL (if scraped) */
  base_url?: string;
  /** Top-level tree structure */
  tree: DocsTreeNode[];
  /** Indexing statistics */
  stats: {
    pages: number;
    total_size_bytes: number;
    indexed_at: string;
  };
  /** How the source was detected (for auto mode) */
  detection_method?: string;
}

/**
 * Parses a GitHub URL to extract owner and repo.
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch/path
 * - github.com/owner/repo
 */
export function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
} | null {
  // Normalize URL
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = "https://" + normalized;
  }

  try {
    const parsed = new URL(normalized);

    // Must be github.com
    if (!parsed.hostname.endsWith("github.com")) {
      return null;
    }

    // Parse path: /owner/repo[/tree/branch/path]
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1].replace(/\.git$/, ""); // Remove .git suffix if present

    let branch: string | undefined;
    let path: string | undefined;

    // Check for /tree/branch/path or /blob/branch/path
    if (
      pathParts.length > 2 &&
      (pathParts[2] === "tree" || pathParts[2] === "blob")
    ) {
      branch = pathParts[3];
      if (pathParts.length > 4) {
        path = pathParts.slice(4).join("/");
      }
    }

    return { owner, repo, branch, path };
  } catch {
    return null;
  }
}

/**
 * Generates a cache ID from owner and repo.
 */
function generateCacheId(owner: string, repo: string): string {
  return `${owner}_${repo}`;
}

/**
 * Collects all file paths from a tree structure.
 */
function collectFilePaths(nodes: DocsTreeNode[]): string[] {
  const paths: string[] = [];

  function walk(nodeList: DocsTreeNode[]) {
    for (const node of nodeList) {
      if (node.type === "file") {
        paths.push(node.path);
      } else if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return paths;
}

/**
 * Indexes documentation from a GitHub repository.
 */
async function indexFromGitHub(
  owner: string,
  repo: string,
  options: {
    branch?: string;
    path?: string;
    forceRefresh?: boolean;
  } = {}
): Promise<IndexDocsOutput> {
  const cacheId = generateCacheId(owner, repo);
  const repoString = `${owner}/${repo}`;

  // Check if already cached (unless force refresh)
  if (!options.forceRefresh) {
    const existing = await cacheManager.getMeta("github", cacheId);
    if (existing && !cacheManager.isExpired(existing)) {
      // Return cached data
      return {
        id: existing.id,
        source: "github",
        repo: existing.repo,
        tree: existing.tree,
        stats: {
          pages: existing.page_count,
          total_size_bytes: existing.total_size_bytes,
          indexed_at: existing.indexed_at,
        },
      };
    }
  }

  // Initialize cache
  await cacheManager.initialize();

  // Fetch the tree structure
  const treeResult: FetchTreeResult = await fetchRepoTree(repoString, {
    branch: options.branch,
    path: options.path,
    extensions: [".md", ".mdx", ".markdown"],
    maxDepth: 10,
  });

  // Collect all file paths to download
  const filePaths = collectFilePaths(treeResult.tree);

  // Download all file contents and build search index
  let totalSize = 0;
  let downloadedCount = 0;
  const searchIndex = new SearchIndex();

  for (const filePath of filePaths) {
    try {
      const content = await fetchFileContent(
        repoString,
        treeResult.branch,
        filePath
      );

      if (content) {
        // Store content in cache
        await cacheManager.storeContent(
          "github",
          cacheId,
          filePath,
          content.content
        );
        totalSize += content.size;
        downloadedCount++;

        // Add to search index
        const indexDoc = createIndexableDocument(filePath, content.content);
        searchIndex.addDocument(indexDoc);
      }
    } catch (error) {
      // Log but continue - some files might fail
      console.error(`Failed to download ${filePath}:`, error);
    }
  }

  // Store search index
  await cacheManager.storeSearchIndex("github", cacheId, searchIndex.toJSON());

  // Store metadata
  const indexedAt = new Date().toISOString();
  await cacheManager.storeMeta({
    id: cacheId,
    source: "github",
    repo: repoString,
    branch: treeResult.branch,
    indexed_at: indexedAt,
    page_count: downloadedCount,
    total_size_bytes: totalSize,
    tree: treeResult.tree,
  });

  return {
    id: cacheId,
    source: "github",
    repo: repoString,
    tree: treeResult.tree,
    stats: {
      pages: downloadedCount,
      total_size_bytes: totalSize,
      indexed_at: indexedAt,
    },
  };
}

/**
 * Generates a cache ID from a URL for scraped content.
 */
function generateScrapedCacheId(url: string): string {
  const domain = extractDomain(url);
  if (!domain) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Clean up domain for use as ID
  return domain
    .replace(/^www\./, "")
    .replace(/\./g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Indexes documentation from a website via scraping.
 */
async function indexFromScraping(
  url: string,
  options: {
    depth?: number;
    forceRefresh?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
  } = {}
): Promise<IndexDocsOutput> {
  const normalizedUrl = normalizeUrl(url);
  const cacheId = generateScrapedCacheId(normalizedUrl);

  // Check if already cached (unless force refresh)
  if (!options.forceRefresh) {
    const existing = await cacheManager.getMeta("scraped", cacheId);
    if (existing && !cacheManager.isExpired(existing)) {
      // Return cached data
      return {
        id: existing.id,
        source: "scraped",
        base_url: existing.base_url,
        tree: existing.tree,
        stats: {
          pages: existing.page_count,
          total_size_bytes: existing.total_size_bytes,
          indexed_at: existing.indexed_at,
        },
      };
    }
  }

  // Initialize cache
  await cacheManager.initialize();

  // Crawl the website
  console.error(`[index_docs] Starting crawl of ${normalizedUrl}...`);
  const crawlResult = await crawlWebsite(normalizedUrl, {
    maxDepth: options.depth ?? 2,
    maxPages: 100,
    requestDelay: 500,
  });

  if (crawlResult.pages.length === 0) {
    // Check if crawling was blocked
    if (
      crawlResult.skipped.some(
        (s) => s.reason.includes("robots.txt") || s.reason.includes("403")
      )
    ) {
      throw new ScrapingBlockedError(
        normalizedUrl,
        "Site blocked automated access"
      );
    }
    throw new NoContentError(normalizedUrl);
  }

  console.error(
    `[index_docs] Crawled ${crawlResult.pages.length} pages, converting to markdown...`
  );

  // Process pages: clean HTML to markdown and store
  let totalSize = 0;
  let processedCount = 0;
  const searchIndex = new SearchIndex();
  const treeNodes: DocsTreeNode[] = [];

  for (const page of crawlResult.pages) {
    try {
      // Clean HTML to markdown
      const cleaned = cleanHtml(page.html, {
        baseUrl: page.url,
        extractMainContent: true,
      });

      // Skip pages with very little content
      if (cleaned.markdown.trim().length < 100) {
        console.error(
          `[index_docs] Skipping ${page.filename} - too little content`
        );
        continue;
      }

      // Add title as H1 if not present and we have a title
      let markdown = cleaned.markdown;
      if (cleaned.title && !markdown.startsWith("# ")) {
        markdown = `# ${cleaned.title}\n\n${markdown}`;
      }

      // Store content in cache
      await cacheManager.storeContent(
        "scraped",
        cacheId,
        page.filename,
        markdown
      );

      const size = Buffer.byteLength(markdown, "utf8");
      totalSize += size;
      processedCount++;

      // Add to tree
      treeNodes.push({
        name: page.filename,
        path: page.filename,
        type: "file",
        size_bytes: size,
      });

      // Add to search index
      const indexDoc = createIndexableDocument(page.filename, markdown);
      searchIndex.addDocument(indexDoc);
    } catch (error) {
      console.error(`[index_docs] Failed to process ${page.url}:`, error);
    }
  }

  if (processedCount === 0) {
    throw new NoContentError(normalizedUrl);
  }

  // Sort tree nodes
  treeNodes.sort((a, b) => a.name.localeCompare(b.name));

  // Store search index
  await cacheManager.storeSearchIndex("scraped", cacheId, searchIndex.toJSON());

  // Store metadata
  const indexedAt = new Date().toISOString();
  await cacheManager.storeMeta({
    id: cacheId,
    source: "scraped",
    base_url: normalizedUrl,
    indexed_at: indexedAt,
    page_count: processedCount,
    total_size_bytes: totalSize,
    tree: treeNodes,
  });

  console.error(
    `[index_docs] Indexed ${processedCount} pages (${(totalSize / 1024).toFixed(
      1
    )} KB)`
  );

  return {
    id: cacheId,
    source: "scraped",
    base_url: normalizedUrl,
    tree: treeNodes,
    stats: {
      pages: processedCount,
      total_size_bytes: totalSize,
      indexed_at: indexedAt,
    },
  };
}

/**
 * Main index_docs implementation.
 * Supports GitHub URLs and website scraping.
 */
export async function indexDocs(
  input: IndexDocsInput
): Promise<IndexDocsOutput> {
  const {
    url,
    type = "auto",
    depth,
    force_refresh = false,
    include_patterns,
    exclude_patterns,
  } = input;

  // Validate required parameters
  if (!url) {
    throw new ValidationError("Missing required parameter: url", "url");
  }

  // Parse URL to determine source
  const githubInfo = parseGitHubUrl(url);

  // Handle explicit type requests
  if (type === "github") {
    if (!githubInfo) {
      throw new InvalidUrlError(
        url,
        "Expected GitHub URL format: https://github.com/owner/repo"
      );
    }

    return indexFromGitHub(githubInfo.owner, githubInfo.repo, {
      branch: githubInfo.branch,
      path: githubInfo.path,
      forceRefresh: force_refresh,
    });
  }

  if (type === "scrape") {
    return indexFromScraping(url, {
      depth,
      forceRefresh: force_refresh,
      includePatterns: include_patterns,
      excludePatterns: exclude_patterns,
    });
  }

  // Auto mode: prefer GitHub if detected, otherwise scrape
  if (type === "auto") {
    // If URL is already a GitHub URL, use it directly
    if (githubInfo) {
      console.error(`[index_docs] Auto-detected: direct GitHub URL`);
      const result = await indexFromGitHub(githubInfo.owner, githubInfo.repo, {
        branch: githubInfo.branch,
        path: githubInfo.path,
        forceRefresh: force_refresh,
      });
      return { ...result, detection_method: "direct_github_url" };
    }

    // Try to detect GitHub repo from the docs site
    console.error(`[index_docs] Auto-detecting GitHub repo from ${url}...`);
    const detection = await detectGitHubRepo(url);

    if (detection.found && detection.repo && detection.confidence !== "low") {
      console.error(
        `[index_docs] Found GitHub repo: ${detection.repo} (${detection.confidence} confidence via ${detection.detection_method})`
      );

      // Parse the detected repo
      const [owner, repo] = detection.repo.split("/");
      if (owner && repo) {
        try {
          const result = await indexFromGitHub(owner, repo, {
            path: detection.docs_path,
            forceRefresh: force_refresh,
          });
          return {
            ...result,
            detection_method: `auto_github_${detection.detection_method}`,
          };
        } catch (error) {
          // GitHub fetch failed, fall back to scraping
          console.error(
            `[index_docs] GitHub fetch failed, falling back to scraping:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    } else {
      console.error(
        `[index_docs] No GitHub repo detected (${detection.detection_method}), using scraping`
      );
    }

    // Fall back to scraping
    const result = await indexFromScraping(url, {
      depth,
      forceRefresh: force_refresh,
      includePatterns: include_patterns,
      excludePatterns: exclude_patterns,
    });
    return { ...result, detection_method: "scraping_fallback" };
  }

  // Should not reach here
  throw new Error(
    `Invalid type: "${type}". Expected "github", "scrape", or "auto".`
  );
}
