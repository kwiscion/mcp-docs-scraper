import type { DocsTreeNode } from "../types/index.js";
import { githubRateLimit } from "../utils/rate-limit.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Response item from GitHub Git Trees API.
 */
interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

/**
 * Response from GitHub Git Trees API.
 */
interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
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
  /** Whether the tree was truncated due to size limits */
  truncated: boolean;
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
export function parseRepoString(repoString: string): {
  owner: string;
  repo: string;
} {
  const parts = repoString.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid repo format: "${repoString}". Expected "owner/repo".`
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Gets GitHub API headers, including auth token if available.
 */
function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "mcp-docs-scraper",
  };

  // Use GITHUB_TOKEN if available (increases rate limit from 60 to 5000/hour)
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Checks if GitHub authentication is configured.
 */
export function isAuthenticated(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Makes a GitHub API request with proper headers and rate limit tracking.
 */
async function githubFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  githubRateLimit.updateFromHeaders(response.headers);

  return response;
}

/**
 * Detects the default branch for a repository using the Git Trees API.
 * Tries "main" first, then "master".
 */
async function detectDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  // Check rate limit before making requests
  if (githubRateLimit.isExhausted()) {
    throw new Error(
      `GitHub API rate limit exhausted. ${githubRateLimit.getStatusMessage()}`
    );
  }

  // Try main first using Git Trees API
  const mainUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/main`;
  const mainResponse = await githubFetch(mainUrl);

  if (mainResponse.ok) {
    return "main";
  }

  // Try master
  const masterUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/master`;
  const masterResponse = await githubFetch(masterUrl);

  if (masterResponse.ok) {
    return "master";
  }

  throw new Error(
    `Could not detect default branch for ${owner}/${repo}. ` +
      `Neither 'main' nor 'master' branches exist or repo is not accessible.`
  );
}

/**
 * Fetches the entire tree from GitHub using the Git Trees API.
 * This uses only 1 API request instead of 1 per directory.
 */
async function fetchGitTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTreeResponse> {
  // Check rate limit before making request
  if (githubRateLimit.isExhausted()) {
    throw new Error(
      `GitHub API rate limit exhausted. ${githubRateLimit.getStatusMessage()}`
    );
  }

  if (githubRateLimit.isLow()) {
    console.error(`Warning: ${githubRateLimit.getStatusMessage()}`);
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await githubFetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Repository or branch not found: ${owner}/${repo}@${branch}`
      );
    }
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<GitHubTreeResponse>;
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
 * Gets the depth of a path (number of directory levels).
 */
function getPathDepth(path: string): number {
  if (!path) return 0;
  return path.split("/").length;
}

/**
 * Gets the file/folder name from a path.
 */
function getNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

/**
 * Gets the parent path from a path.
 */
function getParentPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * Converts a flat list of tree items into a hierarchical DocsTreeNode structure.
 */
function buildHierarchicalTree(
  items: GitHubTreeItem[],
  basePath: string,
  extensions: string[],
  maxDepth: number
): { tree: DocsTreeNode[]; fileCount: number; totalSize: number } {
  // Filter items by base path and extensions
  const filteredItems = items.filter((item) => {
    // Must be under base path
    if (
      basePath &&
      !item.path.startsWith(basePath + "/") &&
      item.path !== basePath
    ) {
      return false;
    }

    // Calculate relative depth
    const relativePath = basePath
      ? item.path.slice(basePath.length + 1)
      : item.path;
    const depth = getPathDepth(relativePath);
    if (depth > maxDepth) {
      return false;
    }

    // For files, check extension filter
    if (item.type === "blob") {
      return shouldIncludeFile(item.path, extensions);
    }

    return true; // Include directories for now, we'll filter empty ones later
  });

  // Build a map of path -> node for quick lookups
  const nodeMap = new Map<string, DocsTreeNode>();
  let fileCount = 0;
  let totalSize = 0;

  // First pass: create nodes for all matching files
  for (const item of filteredItems) {
    if (item.type === "blob") {
      const node: DocsTreeNode = {
        name: getNameFromPath(item.path),
        path: item.path,
        type: "file",
        size_bytes: item.size,
      };
      nodeMap.set(item.path, node);
      fileCount++;
      totalSize += item.size || 0;
    }
  }

  // Second pass: create folder nodes for paths that have files under them
  const folderPaths = new Set<string>();
  for (const item of filteredItems) {
    if (item.type === "blob") {
      // Walk up the path and add all parent folders
      let parentPath = getParentPath(item.path);
      while (
        parentPath &&
        (!basePath ||
          parentPath.startsWith(basePath) ||
          parentPath === basePath)
      ) {
        // Don't add folders above basePath
        if (basePath && parentPath.length < basePath.length) break;
        folderPaths.add(parentPath);
        parentPath = getParentPath(parentPath);
      }
    }
  }

  // Create folder nodes
  for (const folderPath of folderPaths) {
    if (!nodeMap.has(folderPath)) {
      nodeMap.set(folderPath, {
        name: getNameFromPath(folderPath),
        path: folderPath,
        type: "folder",
        children: [],
      });
    }
  }

  // Third pass: build the hierarchy
  for (const [path, node] of nodeMap) {
    const parentPath = getParentPath(path);

    // Skip if this is at the root level (relative to basePath)
    if (!parentPath || (basePath && parentPath.length < basePath.length)) {
      continue;
    }

    const parent = nodeMap.get(parentPath);
    if (parent && parent.type === "folder") {
      parent.children = parent.children || [];
      parent.children.push(node);
    }
  }

  // Collect root-level nodes
  const rootNodes: DocsTreeNode[] = [];
  for (const [path, node] of nodeMap) {
    const parentPath = getParentPath(path);
    const isRootLevel = basePath
      ? path.startsWith(basePath + "/") &&
        !parentPath.includes("/", basePath.length + 1) &&
        parentPath === basePath
      : !path.includes("/");

    // For base path, check if direct child
    if (basePath) {
      const relativePath = path.slice(basePath.length + 1);
      if (!relativePath.includes("/")) {
        rootNodes.push(node);
      }
    } else if (!path.includes("/")) {
      rootNodes.push(node);
    }
  }

  // Sort all nodes: folders first, then files, both alphabetically
  const sortNodes = (nodes: DocsTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  };
  sortNodes(rootNodes);

  return { tree: rootNodes, fileCount, totalSize };
}

/**
 * Fetches the file tree from a GitHub repository.
 * Uses the Git Trees API for efficiency (1 request for entire tree).
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

  // Fetch the entire tree in one API call
  const gitTree = await fetchGitTree(owner, repo, branch);

  if (gitTree.truncated) {
    console.error(
      "Warning: Repository tree was truncated due to size. Some files may be missing."
    );
  }

  // Build hierarchical tree from flat list
  const result = buildHierarchicalTree(
    gitTree.tree,
    path,
    extensions,
    maxDepth
  );

  return {
    repo: `${owner}/${repo}`,
    branch,
    tree: result.tree,
    fileCount: result.fileCount,
    totalSize: result.totalSize,
    truncated: gitTree.truncated,
  };
}

/**
 * Result of fetching file content.
 */
export interface FetchContentResult {
  /** The file path */
  path: string;
  /** The file content */
  content: string;
  /** Size in bytes */
  size: number;
}

/**
 * Fetches raw file content from GitHub via raw.githubusercontent.com.
 * This endpoint has no rate limits (served from CDN).
 *
 * @param repoString Repository in "owner/repo" format
 * @param branch Branch name
 * @param filePath Path to the file within the repo
 * @returns File content or null if not found
 */
export async function fetchFileContent(
  repoString: string,
  branch: string,
  filePath: string
): Promise<FetchContentResult | null> {
  const { owner, repo } = parseRepoString(repoString);

  // Use raw.githubusercontent.com - no rate limits, served from CDN
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "mcp-docs-scraper",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // File not found - return null gracefully
      return null;
    }
    throw new Error(
      `Failed to fetch file content: ${response.status} ${response.statusText}`
    );
  }

  const content = await response.text();

  return {
    path: filePath,
    content,
    size: new TextEncoder().encode(content).length,
  };
}

/**
 * Fetches multiple files from a repository.
 * Handles 404s gracefully by skipping missing files.
 *
 * @param repoString Repository in "owner/repo" format
 * @param branch Branch name
 * @param filePaths Array of file paths to fetch
 * @returns Array of successfully fetched files and array of not found paths
 */
export async function fetchMultipleFiles(
  repoString: string,
  branch: string,
  filePaths: string[]
): Promise<{
  files: FetchContentResult[];
  notFound: string[];
}> {
  const files: FetchContentResult[] = [];
  const notFound: string[] = [];

  // Fetch files in parallel for better performance
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const result = await fetchFileContent(repoString, branch, filePath);
        return { filePath, result };
      } catch (error) {
        // Log error but don't fail the whole batch
        console.error(`Error fetching ${filePath}:`, error);
        return { filePath, result: null };
      }
    })
  );

  for (const { filePath, result } of results) {
    if (result) {
      files.push(result);
    } else {
      notFound.push(filePath);
    }
  }

  return { files, notFound };
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
