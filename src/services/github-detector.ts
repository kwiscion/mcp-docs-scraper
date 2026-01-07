/**
 * GitHub Detector Service - Detects GitHub repository from documentation websites.
 *
 * Detection strategies (in order of confidence):
 * 1. Direct GitHub URL → high confidence
 * 2. github.io pattern → high confidence
 * 3. "Edit on GitHub" links → high confidence
 * 4. GitHub links in page content → medium confidence
 * 5. Meta tags with repo info → medium confidence
 */

import { parseGitHubUrl } from "../tools/index-docs.js";

/**
 * Result of GitHub repository detection.
 */
export interface GitHubDetectionResult {
  /** Whether a GitHub repository was found */
  found: boolean;
  /** Repository in "owner/repo" format */
  repo?: string;
  /** Path within the repo where docs are located */
  docs_path?: string;
  /** Confidence level of the detection */
  confidence: "high" | "medium" | "low";
  /** How the repo was detected (for debugging) */
  detection_method?: string;
}

/**
 * Options for GitHub detection.
 */
export interface DetectionOptions {
  /** Timeout for fetching the page (ms) */
  timeout?: number;
  /** User agent for requests */
  userAgent?: string;
}

const DEFAULT_OPTIONS: Required<DetectionOptions> = {
  timeout: 10000,
  userAgent: "mcp-docs-scraper/1.0 (github-detector)",
};

/**
 * Patterns for detecting GitHub links in HTML.
 */
const GITHUB_LINK_PATTERNS = [
  // Edit on GitHub links (highest priority)
  /href=["']([^"']*github\.com\/[^"'\/]+\/[^"'\/]+(?:\/[^"']*)?)["'][^>]*>(?:[^<]*(?:edit|view|source)[^<]*github|github[^<]*(?:edit|view|source))/gi,
  // General GitHub repo links
  /href=["'](https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+))(?:\/[^"']*)?["']/gi,
];

/**
 * Extracts owner/repo from a GitHub URL.
 */
function extractRepoFromUrl(url: string): { owner: string; repo: string; path?: string } | null {
  try {
    const parsed = new URL(url);
    
    if (!parsed.hostname.includes("github.com") && !parsed.hostname.includes("github.io")) {
      return null;
    }

    // Handle github.io URLs
    if (parsed.hostname.endsWith(".github.io")) {
      const owner = parsed.hostname.replace(".github.io", "");
      // For github.io, the first path segment is usually the repo
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const repo = pathParts[0] || `${owner}.github.io`;
      return { owner, repo };
    }

    // Handle github.com URLs
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      const owner = pathParts[0];
      const repo = pathParts[1].replace(/\.git$/, "");
      const path = pathParts.length > 2 ? pathParts.slice(2).join("/") : undefined;
      return { owner, repo, path };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detects if the URL itself is a GitHub URL or github.io URL.
 */
function detectFromUrl(url: string): GitHubDetectionResult | null {
  // Check if it's already a GitHub URL
  const githubInfo = parseGitHubUrl(url);
  if (githubInfo) {
    return {
      found: true,
      repo: `${githubInfo.owner}/${githubInfo.repo}`,
      docs_path: githubInfo.path,
      confidence: "high",
      detection_method: "direct_github_url",
    };
  }

  // Check for github.io pattern
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".github.io")) {
      const owner = parsed.hostname.replace(".github.io", "");
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      
      // For github.io sites, the repo is often the first path segment
      // or it could be a user/org pages site (owner.github.io)
      if (pathParts.length > 0) {
        // Could be a project page: owner.github.io/repo-name
        return {
          found: true,
          repo: `${owner}/${pathParts[0]}`,
          confidence: "high",
          detection_method: "github_io_project",
        };
      } else {
        // User/org pages: owner.github.io → owner/owner.github.io
        return {
          found: true,
          repo: `${owner}/${owner}.github.io`,
          confidence: "high",
          detection_method: "github_io_user",
        };
      }
    }
  } catch {
    // Invalid URL
  }

  return null;
}

/**
 * Extracts GitHub repo from "Edit on GitHub" or similar links in HTML.
 */
function detectFromEditLinks(html: string): GitHubDetectionResult | null {
  // Look for "Edit on GitHub" style links
  const editPatterns = [
    /href=["']([^"']*github\.com\/[^"']+)["'][^>]*>[^<]*edit[^<]*on[^<]*github/gi,
    /href=["']([^"']*github\.com\/[^"']+)["'][^>]*>[^<]*view[^<]*on[^<]*github/gi,
    /href=["']([^"']*github\.com\/[^"']+)["'][^>]*>[^<]*source[^<]*on[^<]*github/gi,
    /href=["']([^"']*github\.com\/[^"']+)["'][^>]*>[^<]*github[^<]*source/gi,
    /"editUrl":\s*"([^"]*github\.com\/[^"]+)"/gi,
    /"edit_uri":\s*"([^"]*github\.com\/[^"]+)"/gi,
  ];

  for (const pattern of editPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const repoInfo = extractRepoFromUrl(match[1]);
      if (repoInfo) {
        return {
          found: true,
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          docs_path: repoInfo.path,
          confidence: "high",
          detection_method: "edit_on_github_link",
        };
      }
    }
    // Reset regex lastIndex
    pattern.lastIndex = 0;
  }

  return null;
}

/**
 * Extracts GitHub repo from general GitHub links in HTML.
 */
function detectFromLinks(html: string): GitHubDetectionResult | null {
  // Find all GitHub links
  const linkPattern = /href=["'](https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+))(?:\/[^"']*)?["']/gi;
  const repos = new Map<string, number>();

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const owner = match[2];
    const repo = match[3].replace(/\.git$/, "");
    
    // Skip common non-repo patterns
    if (["issues", "pulls", "discussions", "sponsors", "marketplace"].includes(repo)) {
      continue;
    }
    
    const key = `${owner}/${repo}`;
    repos.set(key, (repos.get(key) || 0) + 1);
  }

  if (repos.size === 0) {
    return null;
  }

  // Find the most frequently linked repo
  let bestRepo = "";
  let maxCount = 0;
  for (const [repo, count] of repos) {
    if (count > maxCount) {
      maxCount = count;
      bestRepo = repo;
    }
  }

  if (bestRepo) {
    return {
      found: true,
      repo: bestRepo,
      confidence: maxCount >= 3 ? "medium" : "low",
      detection_method: `github_links_found_${maxCount}`,
    };
  }

  return null;
}

/**
 * Extracts GitHub repo from meta tags.
 */
function detectFromMetaTags(html: string): GitHubDetectionResult | null {
  // Look for og:url or other meta tags with GitHub info
  const metaPatterns = [
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+github\.com[^"']+)["']/gi,
    /<meta[^>]+name=["']github:repo["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+github\.com[^"']+)["'][^>]+property=["']og:url["']/gi,
  ];

  for (const pattern of metaPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const repoInfo = extractRepoFromUrl(match[1]);
      if (repoInfo) {
        return {
          found: true,
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          confidence: "medium",
          detection_method: "meta_tag",
        };
      }
    }
    pattern.lastIndex = 0;
  }

  return null;
}

/**
 * Fetches a webpage and returns its HTML content.
 */
async function fetchPage(url: string, options: Required<DetectionOptions>): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": options.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeout),
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Detects GitHub repository from a documentation website URL.
 *
 * @param url The URL to analyze
 * @param options Detection options
 * @returns Detection result with repo info and confidence
 */
export async function detectGitHubRepo(
  url: string,
  options: DetectionOptions = {}
): Promise<GitHubDetectionResult> {
  const opts: Required<DetectionOptions> = { ...DEFAULT_OPTIONS, ...options };

  // Strategy 1: Check if URL itself is GitHub or github.io
  const urlResult = detectFromUrl(url);
  if (urlResult) {
    return urlResult;
  }

  // Strategy 2-5: Fetch the page and analyze content
  const html = await fetchPage(url, opts);
  if (!html) {
    return {
      found: false,
      confidence: "low",
      detection_method: "fetch_failed",
    };
  }

  // Strategy 2: Look for "Edit on GitHub" links (highest confidence)
  const editResult = detectFromEditLinks(html);
  if (editResult) {
    return editResult;
  }

  // Strategy 3: Look for meta tags
  const metaResult = detectFromMetaTags(html);
  if (metaResult) {
    return metaResult;
  }

  // Strategy 4: Look for any GitHub links
  const linkResult = detectFromLinks(html);
  if (linkResult) {
    return linkResult;
  }

  // No GitHub repo found
  return {
    found: false,
    confidence: "low",
    detection_method: "no_github_found",
  };
}

/**
 * GitHub detector singleton for convenience.
 */
export const githubDetector = {
  detect: detectGitHubRepo,
};

