/**
 * Web Scraper Service - Crawls documentation websites.
 *
 * Responsibilities:
 * - Crawl docs websites with depth limit
 * - Respect robots.txt
 * - Extract and normalize links
 * - Rate limiting between requests
 */

import {
  normalizeUrl,
  extractLinks,
  isSameDomain,
  urlToFilename,
} from "../utils/url.js";

/**
 * Options for the web scraper.
 */
export interface ScraperOptions {
  /** Maximum crawl depth (default: 2, max: 5) */
  maxDepth?: number;
  /** Delay between requests in ms (default: 500) */
  requestDelay?: number;
  /** Maximum pages to crawl (default: 100) */
  maxPages?: number;
  /** Whether to respect robots.txt (default: true) */
  respectRobotsTxt?: boolean;
  /** Custom user agent */
  userAgent?: string;
}

/**
 * Result of scraping a single page.
 */
export interface ScrapedPage {
  /** Original URL */
  url: string;
  /** Normalized URL */
  normalizedUrl: string;
  /** Safe filename for caching */
  filename: string;
  /** Raw HTML content */
  html: string;
  /** HTTP status code */
  status: number;
  /** Content type header */
  contentType: string;
  /** Crawl depth this page was found at */
  depth: number;
  /** Links found on this page */
  links: string[];
}

/**
 * Result of a complete crawl operation.
 */
export interface CrawlResult {
  /** Base URL that was crawled */
  baseUrl: string;
  /** All successfully scraped pages */
  pages: ScrapedPage[];
  /** URLs that failed to fetch */
  failed: Array<{ url: string; reason: string }>;
  /** URLs that were skipped (robots.txt, external, etc.) */
  skipped: Array<{ url: string; reason: string }>;
  /** Crawl statistics */
  stats: {
    totalDiscovered: number;
    totalCrawled: number;
    totalFailed: number;
    totalSkipped: number;
    maxDepthReached: number;
    durationMs: number;
  };
}

/**
 * Parsed robots.txt rules.
 */
interface RobotsRules {
  disallowedPaths: string[];
  crawlDelay?: number;
}

/**
 * Default scraper options.
 */
const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  maxDepth: 2,
  requestDelay: 500,
  maxPages: 100,
  respectRobotsTxt: true,
  userAgent: "mcp-docs-scraper/1.0 (documentation indexer)",
};

/**
 * Maximum allowed depth.
 */
const MAX_DEPTH = 5;

/**
 * Fetches and parses robots.txt for a domain.
 */
async function fetchRobotsTxt(
  baseUrl: string,
  userAgent: string
): Promise<RobotsRules> {
  const rules: RobotsRules = {
    disallowedPaths: [],
  };

  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return rules; // No robots.txt or error - allow all
    }

    const text = await response.text();
    const lines = text.split("\n");

    let isRelevantUserAgent = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      // Check user-agent directive
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.slice(11).trim();
        isRelevantUserAgent = agent === "*" || userAgent.toLowerCase().includes(agent);
      }

      // Parse disallow directive
      if (isRelevantUserAgent && trimmed.startsWith("disallow:")) {
        const path = line.trim().slice(9).trim();
        if (path) {
          rules.disallowedPaths.push(path);
        }
      }

      // Parse crawl-delay directive
      if (isRelevantUserAgent && trimmed.startsWith("crawl-delay:")) {
        const delay = parseInt(line.trim().slice(12).trim(), 10);
        if (!isNaN(delay)) {
          rules.crawlDelay = delay * 1000; // Convert to ms
        }
      }
    }
  } catch {
    // Ignore errors - assume allowed
  }

  return rules;
}

/**
 * Checks if a URL is disallowed by robots.txt rules.
 */
function isDisallowed(url: string, rules: RobotsRules): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    for (const disallowed of rules.disallowedPaths) {
      // Handle wildcard patterns
      if (disallowed.includes("*")) {
        const regex = new RegExp(
          "^" + disallowed.replace(/\*/g, ".*").replace(/\?/g, "\\?") + "$"
        );
        if (regex.test(pathname)) {
          return true;
        }
      } else if (pathname.startsWith(disallowed)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Fetches a single page.
 */
async function fetchPage(
  url: string,
  userAgent: string
): Promise<{ html: string; status: number; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    const contentType = response.headers.get("content-type") || "";

    // Only process HTML content
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const html = await response.text();

    return {
      html,
      status: response.status,
      contentType,
    };
  } catch {
    return null;
  }
}

/**
 * Delays execution for a specified time.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Crawls a documentation website starting from a base URL.
 *
 * @param startUrl The URL to start crawling from
 * @param options Scraper options
 * @returns CrawlResult with all scraped pages and statistics
 */
export async function crawlWebsite(
  startUrl: string,
  options: ScraperOptions = {}
): Promise<CrawlResult> {
  const startTime = Date.now();

  // Merge options with defaults
  const opts: Required<ScraperOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    maxDepth: Math.min(options.maxDepth || DEFAULT_OPTIONS.maxDepth, MAX_DEPTH),
  };

  // Normalize starting URL
  const baseUrl = normalizeUrl(startUrl);

  // Initialize result
  const result: CrawlResult = {
    baseUrl,
    pages: [],
    failed: [],
    skipped: [],
    stats: {
      totalDiscovered: 1,
      totalCrawled: 0,
      totalFailed: 0,
      totalSkipped: 0,
      maxDepthReached: 0,
      durationMs: 0,
    },
  };

  // Fetch robots.txt if needed
  let robotsRules: RobotsRules = { disallowedPaths: [] };
  if (opts.respectRobotsTxt) {
    robotsRules = await fetchRobotsTxt(baseUrl, opts.userAgent);
    if (robotsRules.crawlDelay) {
      opts.requestDelay = Math.max(opts.requestDelay, robotsRules.crawlDelay);
    }
  }

  // Track visited URLs and queue
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];

  while (queue.length > 0 && result.pages.length < opts.maxPages) {
    const current = queue.shift()!;
    const { url, depth } = current;

    // Skip if already visited
    if (visited.has(url)) {
      continue;
    }
    visited.add(url);

    // Check robots.txt
    if (opts.respectRobotsTxt && isDisallowed(url, robotsRules)) {
      result.skipped.push({ url, reason: "disallowed by robots.txt" });
      result.stats.totalSkipped++;
      continue;
    }

    // Check same domain
    if (!isSameDomain(url, baseUrl)) {
      result.skipped.push({ url, reason: "external domain" });
      result.stats.totalSkipped++;
      continue;
    }

    // Add delay between requests (except first)
    if (result.stats.totalCrawled > 0) {
      await delay(opts.requestDelay);
    }

    // Fetch the page
    const pageResult = await fetchPage(url, opts.userAgent);

    if (!pageResult) {
      result.failed.push({ url, reason: "fetch failed or non-HTML content" });
      result.stats.totalFailed++;
      continue;
    }

    // Extract links for further crawling
    const links = depth < opts.maxDepth ? extractLinks(pageResult.html, url) : [];

    // Create scraped page
    const page: ScrapedPage = {
      url,
      normalizedUrl: normalizeUrl(url),
      filename: urlToFilename(url),
      html: pageResult.html,
      status: pageResult.status,
      contentType: pageResult.contentType,
      depth,
      links,
    };

    result.pages.push(page);
    result.stats.totalCrawled++;
    result.stats.maxDepthReached = Math.max(result.stats.maxDepthReached, depth);

    // Add new links to queue
    if (depth < opts.maxDepth) {
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 });
          result.stats.totalDiscovered++;
        }
      }
    }

    // Log progress
    console.error(`[scraper] Crawled ${result.stats.totalCrawled}/${opts.maxPages}: ${url} (depth ${depth})`);
  }

  // Update final stats
  result.stats.durationMs = Date.now() - startTime;

  return result;
}

/**
 * Web scraper singleton for convenience.
 */
export const webScraper = {
  crawl: crawlWebsite,
};

