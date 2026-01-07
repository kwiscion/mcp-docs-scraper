/**
 * URL utilities for web scraping.
 *
 * Provides URL normalization, domain extraction, and link filtering.
 */

/**
 * Tracking parameters to remove from URLs.
 */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "msclkid",
  "_ga",
];

/**
 * Normalizes a URL by removing fragments, tracking params, and normalizing format.
 *
 * @param url The URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove fragment
    parsed.hash = "";

    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining search params for consistency
    parsed.searchParams.sort();

    // Normalize path - remove trailing slash except for root
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Decode URL-encoded characters in pathname for readability
    try {
      parsed.pathname = decodeURIComponent(parsed.pathname);
    } catch {
      // Keep as-is if decoding fails
    }

    return parsed.href;
  } catch {
    // Return as-is if URL is invalid
    return url;
  }
}

/**
 * Extracts the domain (host) from a URL.
 *
 * @param url The URL to extract domain from
 * @returns Domain string or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Checks if two URLs are on the same domain.
 *
 * @param url1 First URL
 * @param url2 Second URL
 * @returns True if same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);

  if (!domain1 || !domain2) {
    return false;
  }

  // Handle www prefix variations
  const normalize = (d: string) => d.replace(/^www\./, "");
  return normalize(domain1) === normalize(domain2);
}

/**
 * Resolves a potentially relative URL against a base URL.
 *
 * @param href The href to resolve (may be relative or absolute)
 * @param baseUrl The base URL to resolve against
 * @returns Absolute URL string or null if invalid
 */
export function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    // Handle protocol-relative URLs
    if (href.startsWith("//")) {
      const base = new URL(baseUrl);
      return new URL(`${base.protocol}${href}`).href;
    }

    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Checks if a URL should be crawled based on various criteria.
 *
 * @param url The URL to check
 * @param baseUrl The base URL of the crawl
 * @returns Object with isValid boolean and reason if invalid
 */
export function shouldCrawl(
  url: string,
  baseUrl: string
): { isValid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Only HTTP/HTTPS
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { isValid: false, reason: "non-http protocol" };
    }

    // Must be same domain
    if (!isSameDomain(url, baseUrl)) {
      return { isValid: false, reason: "external domain" };
    }

    // Skip common non-content paths
    const skipPatterns = [
      /\/api\//i,
      /\/auth\//i,
      /\/login/i,
      /\/logout/i,
      /\/signup/i,
      /\/register/i,
      /\/admin/i,
      /\/cdn-cgi\//i,
      /\.(pdf|zip|tar|gz|exe|dmg|pkg|deb|rpm)$/i,
      /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i,
      /\.(css|js|json|xml|rss|atom)$/i,
      /\.(mp3|mp4|avi|mov|wmv|flv|webm)$/i,
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(parsed.pathname)) {
        return { isValid: false, reason: "non-content path" };
      }
    }

    return { isValid: true };
  } catch {
    return { isValid: false, reason: "invalid URL" };
  }
}

/**
 * Extracts all links from an HTML document.
 *
 * @param html The HTML content
 * @param baseUrl The base URL for resolving relative links
 * @returns Array of absolute URLs found in the document
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // Simple regex to extract href attributes
  // This is faster than parsing full DOM for link extraction
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];

    // Skip anchors, javascript, mailto, tel
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }

    const resolved = resolveUrl(href, baseUrl);
    if (resolved) {
      const normalized = normalizeUrl(resolved);

      // Check if should crawl and not seen
      const { isValid } = shouldCrawl(normalized, baseUrl);
      if (isValid && !seen.has(normalized)) {
        seen.add(normalized);
        links.push(normalized);
      }
    }
  }

  return links;
}

/**
 * Gets the path depth of a URL (number of path segments).
 *
 * @param url The URL to analyze
 * @returns Number of path segments
 */
export function getPathDepth(url: string): number {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length;
  } catch {
    return 0;
  }
}

/**
 * Converts a URL to a safe filename for caching.
 *
 * @param url The URL to convert
 * @returns Safe filename string
 */
export function urlToFilename(url: string): string {
  try {
    const parsed = new URL(url);

    // Use pathname as base
    let filename = parsed.pathname;

    // Add search params hash if present
    if (parsed.search) {
      const hash = simpleHash(parsed.search);
      filename += `_${hash}`;
    }

    // Clean up the filename
    filename = filename
      .replace(/^\//, "") // Remove leading slash
      .replace(/\//g, "_") // Replace slashes with underscores
      .replace(/[^a-zA-Z0-9_.-]/g, "_") // Replace special chars
      .replace(/_+/g, "_") // Collapse multiple underscores
      .slice(0, 200); // Limit length

    // Ensure it ends with .md for markdown files
    if (!filename.endsWith(".md")) {
      filename = filename || "index";
      filename += ".md";
    }

    return filename;
  } catch {
    return "page.md";
  }
}

/**
 * Simple string hash for deduplication.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

