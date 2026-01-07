/**
 * Shared types - re-exports from domain-specific type files.
 */

export type {
  DocsTreeNode,
  CacheMeta,
  CacheEntrySummary,
} from "./cache.js";

export {
  DocsError,
  InvalidUrlError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubAccessDeniedError,
  CacheNotFoundError,
  ScrapingBlockedError,
  NoContentError,
  NetworkError,
  ValidationError,
  wrapError,
  createErrorResponse,
  type DocsErrorCode,
} from "./errors.js";

