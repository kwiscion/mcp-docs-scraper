/**
 * index_docs tool - Fetches and caches documentation from GitHub repositories.
 */

import type { DocsTreeNode } from "../types/cache.js";
import { cacheManager } from "../services/cache-manager.js";
import {
  fetchRepoTree,
  fetchFileContent,
  type FetchTreeResult,
} from "../services/github-fetcher.js";

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
    if (pathParts.length > 2 && (pathParts[2] === "tree" || pathParts[2] === "blob")) {
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

  // Download all file contents
  let totalSize = 0;
  let downloadedCount = 0;

  for (const filePath of filePaths) {
    try {
      const content = await fetchFileContent(
        repoString,
        treeResult.branch,
        filePath
      );

      if (content) {
        await cacheManager.storeContent("github", cacheId, filePath, content.content);
        totalSize += content.size;
        downloadedCount++;
      }
    } catch (error) {
      // Log but continue - some files might fail
      console.error(`Failed to download ${filePath}:`, error);
    }
  }

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
 * Main index_docs implementation.
 * Currently only supports GitHub URLs.
 */
export async function indexDocs(input: IndexDocsInput): Promise<IndexDocsOutput> {
  const { url, type = "auto", force_refresh = false } = input;

  // Parse URL to determine source
  const githubInfo = parseGitHubUrl(url);

  if (type === "github" || (type === "auto" && githubInfo)) {
    if (!githubInfo) {
      throw new Error(
        `Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`
      );
    }

    return indexFromGitHub(githubInfo.owner, githubInfo.repo, {
      branch: githubInfo.branch,
      path: githubInfo.path,
      forceRefresh: force_refresh,
    });
  }

  if (type === "scrape") {
    // Scraping not yet implemented
    throw new Error(
      "Web scraping is not yet implemented. Please use a GitHub URL instead."
    );
  }

  // Auto mode but couldn't detect GitHub
  throw new Error(
    `Could not determine documentation source for URL: "${url}". ` +
      `Please provide a GitHub repository URL (e.g., https://github.com/owner/repo).`
  );
}

