import type { DocsTreeNode } from "../types/index.js";
import { githubRateLimit } from "../utils/rate-limit.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Response from GitHub Contents API for a single item.
 */
interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  url: string;
  download_url: string | null;
}

/**
 * Result of fetching a repository tree.
 */
export interface FetchTreeResult {
  /** The repository in "owner/repo" format */
  repo: string;
  /** The branch that was used */
  branch: string;
  /** The hierarchical file tree */
  tree: DocsTreeNode[];
  /** Total number of files found */
  fileCount: number;
  /** Total size of all files in bytes */
  totalSize: number;
}

/**
 * Options for tree fetching.
 */
export interface FetchTreeOptions {
  /** Starting path within the repo (default: root) */
  path?: string;
  /** Branch to use (default: auto-detect main/master) */
  branch?: string;
  /** File extensions to include (default: all markdown) */
  extensions?: string[];
  /** Maximum depth to traverse (default: 10) */
  maxDepth?: number;
}

const DEFAULT_EXTENSIONS = [".md", ".mdx", ".markdown"];

/**
 * Parses "owner/repo" format into separate parts.
 */
export function parseRepoString(repoString: string): { owner: string; repo: string } {
  const parts = repoString.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid repo format: "${repoString}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Detects the default branch for a repository.
 * Tries "main" first, then "master".
 */
async function detectDefaultBranch(owner: string, repo: string): Promise<string> {
  // Try main first
  const mainUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents?ref=main`;
  const mainResponse = await fetch(mainUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "mcp-docs-scraper",
    },
  });

  githubRateLimit.updateFromHeaders(mainResponse.headers);

  if (mainResponse.ok) {
    return "main";
  }

  // Try master
  const masterUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents?ref=master`;
  const masterResponse = await fetch(masterUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "mcp-docs-scraper",
    },
  });

  githubRateLimit.updateFromHeaders(masterResponse.headers);

  if (masterResponse.ok) {
    return "master";
  }

  throw new Error(
    `Could not detect default branch for ${owner}/${repo}. ` +
    `Neither 'main' nor 'master' branches exist or repo is not accessible.`
  );
}

/**
 * Fetches contents of a directory from GitHub.
 */
async function fetchDirectoryContents(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<GitHubContentItem[]> {
  const url = path
    ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    : `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "mcp-docs-scraper",
    },
  });

  githubRateLimit.updateFromHeaders(response.headers);

  if (!response.ok) {
    if (response.status === 404) {
      return []; // Directory doesn't exist, return empty
    }
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} for path "${path}"`
    );
  }

  const data = await response.json();

  // Single file returns an object, directory returns array
  if (!Array.isArray(data)) {
    return [data as GitHubContentItem];
  }

  return data as GitHubContentItem[];
}

/**
 * Checks if a file should be included based on extension filter.
 */
function shouldIncludeFile(filename: string, extensions: string[]): boolean {
  if (extensions.length === 0) return true;
  const lowerName = filename.toLowerCase();
  return extensions.some((ext) => lowerName.endsWith(ext.toLowerCase()));
}

/**
 * Recursively builds a tree from GitHub contents.
 */
async function buildTree(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  extensions: string[],
  currentDepth: number,
  maxDepth: number
): Promise<{ nodes: DocsTreeNode[]; fileCount: number; totalSize: number }> {
  if (currentDepth > maxDepth) {
    return { nodes: [], fileCount: 0, totalSize: 0 };
  }

  // Check rate limit before making request
  if (githubRateLimit.isExhausted()) {
    throw new Error(
      `GitHub API rate limit exhausted. ${githubRateLimit.getStatusMessage()}`
    );
  }

  if (githubRateLimit.isLow()) {
    console.error(`Warning: ${githubRateLimit.getStatusMessage()}`);
  }

  const contents = await fetchDirectoryContents(owner, repo, path, branch);
  const nodes: DocsTreeNode[] = [];
  let fileCount = 0;
  let totalSize = 0;

  for (const item of contents) {
    if (item.type === "dir") {
      // Recursively process directory
      const subResult = await buildTree(
        owner,
        repo,
        item.path,
        branch,
        extensions,
        currentDepth + 1,
        maxDepth
      );

      // Only include directory if it has matching files
      if (subResult.nodes.length > 0) {
        nodes.push({
          name: item.name,
          path: item.path,
          type: "folder",
          children: subResult.nodes,
        });
        fileCount += subResult.fileCount;
        totalSize += subResult.totalSize;
      }
    } else if (item.type === "file") {
      // Include file if it matches extension filter
      if (shouldIncludeFile(item.name, extensions)) {
        nodes.push({
          name: item.name,
          path: item.path,
          type: "file",
          size_bytes: item.size,
        });
        fileCount++;
        totalSize += item.size;
      }
    }
  }

  // Sort: folders first, then files, both alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return { nodes, fileCount, totalSize };
}

/**
 * Fetches the file tree from a GitHub repository.
 *
 * @param repoString Repository in "owner/repo" format
 * @param options Fetch options
 * @returns Tree structure with metadata
 */
export async function fetchRepoTree(
  repoString: string,
  options: FetchTreeOptions = {}
): Promise<FetchTreeResult> {
  const { owner, repo } = parseRepoString(repoString);
  const {
    path = "",
    branch: requestedBranch,
    extensions = DEFAULT_EXTENSIONS,
    maxDepth = 10,
  } = options;

  // Detect or use specified branch
  const branch = requestedBranch || (await detectDefaultBranch(owner, repo));

  // Build the tree
  const result = await buildTree(
    owner,
    repo,
    path,
    branch,
    extensions,
    0,
    maxDepth
  );

  return {
    repo: `${owner}/${repo}`,
    branch,
    tree: result.nodes,
    fileCount: result.fileCount,
    totalSize: result.totalSize,
  };
}

/**
 * Gets the current GitHub API rate limit status.
 */
export function getRateLimitStatus(): string {
  return githubRateLimit.getStatusMessage();
}

/**
 * Gets the raw rate limit info.
 */
export function getRateLimitInfo() {
  return githubRateLimit.getInfo();
}

