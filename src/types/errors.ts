/**
 * Custom error types for MCP Docs Scraper.
 *
 * All errors extend DocsError for consistent handling.
 */

/**
 * Error codes for categorizing errors.
 */
export type DocsErrorCode =
  | "INVALID_URL"
  | "GITHUB_RATE_LIMIT"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_ACCESS_DENIED"
  | "CACHE_NOT_FOUND"
  | "SCRAPING_BLOCKED"
  | "NO_CONTENT"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Base error class for all documentation-related errors.
 * Provides structured error information for agents.
 */
export class DocsError extends Error {
  /** Error code for categorization */
  readonly code: DocsErrorCode;
  /** User-friendly message */
  readonly userMessage: string;
  /** Recovery suggestions */
  readonly suggestions: string[];
  /** Additional context */
  readonly context?: Record<string, unknown>;

  constructor(
    code: DocsErrorCode,
    message: string,
    options: {
      userMessage?: string;
      suggestions?: string[];
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "DocsError";
    this.code = code;
    this.userMessage = options.userMessage || message;
    this.suggestions = options.suggestions || [];
    this.context = options.context;
  }

  /**
   * Converts the error to a structured object for MCP responses.
   */
  toJSON(): Record<string, unknown> {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      suggestions: this.suggestions.length > 0 ? this.suggestions : undefined,
      context: this.context,
    };
  }
}

/**
 * Error for invalid URLs.
 */
export class InvalidUrlError extends DocsError {
  constructor(url: string, reason?: string) {
    super("INVALID_URL", `Invalid URL: ${url}${reason ? ` - ${reason}` : ""}`, {
      userMessage: "Could not access URL. Check the URL is correct and accessible.",
      suggestions: [
        "Verify the URL is spelled correctly",
        "Ensure the URL includes the protocol (https://)",
        "Check if the website is accessible in a browser",
      ],
      context: { url, reason },
    });
  }
}

/**
 * Error for GitHub rate limit exceeded.
 */
export class GitHubRateLimitError extends DocsError {
  constructor(resetTime?: Date) {
    const resetIn = resetTime
      ? Math.ceil((resetTime.getTime() - Date.now()) / 60000)
      : undefined;

    super("GITHUB_RATE_LIMIT", "GitHub API rate limit exceeded", {
      userMessage: resetIn
        ? `GitHub API rate limit reached. Try again in ${resetIn} minutes or use scraping fallback.`
        : "GitHub API rate limit reached. Try again later or use scraping fallback.",
      suggestions: [
        'Use type: "scrape" to fetch via web scraping instead',
        "Set GITHUB_TOKEN environment variable for higher rate limits (5000/hour)",
        "Wait for the rate limit to reset",
      ],
      context: { resetTime: resetTime?.toISOString(), resetInMinutes: resetIn },
    });
  }
}

/**
 * Error for GitHub repository not found.
 */
export class GitHubNotFoundError extends DocsError {
  constructor(repo: string) {
    super("GITHUB_NOT_FOUND", `GitHub repository not found: ${repo}`, {
      userMessage: `Repository "${repo}" not found on GitHub.`,
      suggestions: [
        "Check if the repository name is spelled correctly",
        "Verify the repository exists and is public",
        "Use the full URL format: https://github.com/owner/repo",
      ],
      context: { repo },
    });
  }
}

/**
 * Error for GitHub access denied (private repo).
 */
export class GitHubAccessDeniedError extends DocsError {
  constructor(repo: string) {
    super("GITHUB_ACCESS_DENIED", `Access denied to repository: ${repo}`, {
      userMessage: `Cannot access repository "${repo}". It may be private or restricted.`,
      suggestions: [
        "Ensure the repository is public",
        "Set GITHUB_TOKEN with appropriate permissions",
        'Use type: "scrape" if documentation is available on a public website',
      ],
      context: { repo },
    });
  }
}

/**
 * Error for cache entry not found.
 */
export class CacheNotFoundError extends DocsError {
  constructor(docsId: string) {
    super("CACHE_NOT_FOUND", `Documentation not found in cache: ${docsId}`, {
      userMessage: `Documentation "${docsId}" not found in cache.`,
      suggestions: [
        "Run index_docs first to fetch and cache the documentation",
        "Use list_cached_docs to see available cached documentation",
        "Check if the docs_id is spelled correctly",
      ],
      context: { docsId },
    });
  }
}

/**
 * Error for scraping blocked.
 */
export class ScrapingBlockedError extends DocsError {
  constructor(url: string, reason?: string) {
    super("SCRAPING_BLOCKED", `Scraping blocked for ${url}`, {
      userMessage: "Website blocked automated access.",
      suggestions: [
        "Try using a GitHub repository URL if available",
        "Use detect_github_repo to find the source repository",
        "The website may require authentication or block bots",
      ],
      context: { url, reason },
    });
  }
}

/**
 * Error for no content found.
 */
export class NoContentError extends DocsError {
  constructor(url: string) {
    super("NO_CONTENT", `No documentation content found at ${url}`, {
      userMessage: "No documentation content found at this URL.",
      suggestions: [
        "Try a different starting URL (e.g., /docs or /documentation)",
        "Increase the crawl depth if content is nested",
        "Check if the URL returns actual documentation content",
      ],
      context: { url },
    });
  }
}

/**
 * Error for network failures.
 */
export class NetworkError extends DocsError {
  constructor(url: string, cause?: Error) {
    super("NETWORK_ERROR", `Network error accessing ${url}`, {
      userMessage: "Could not connect to the server. Check your network connection.",
      suggestions: [
        "Verify your internet connection",
        "Check if the website is online",
        "Try again in a few moments",
      ],
      context: { url },
      cause,
    });
  }
}

/**
 * Error for validation failures.
 */
export class ValidationError extends DocsError {
  constructor(message: string, field?: string) {
    super("VALIDATION_ERROR", message, {
      userMessage: message,
      suggestions: ["Check the input parameters", "Refer to the tool description for required fields"],
      context: { field },
    });
  }
}

/**
 * Wraps an unknown error in a DocsError.
 */
export function wrapError(error: unknown, context?: string): DocsError {
  if (error instanceof DocsError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new DocsError("UNKNOWN_ERROR", context ? `${context}: ${message}` : message, {
    userMessage: "An unexpected error occurred.",
    suggestions: ["Try the operation again", "Check the input parameters"],
    cause,
  });
}

/**
 * Creates a structured error response for MCP tools.
 */
export function createErrorResponse(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const docsError = error instanceof DocsError ? error : wrapError(error);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(docsError.toJSON(), null, 2),
      },
    ],
    isError: true,
  };
}

