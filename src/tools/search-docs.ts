/**
 * search_docs tool - Full-text search within cached documentation.
 */

import { cacheManager } from "../services/cache-manager.js";
import { SearchIndex, type SearchResult } from "../services/search-index.js";
import { CacheNotFoundError, ValidationError, DocsError } from "../types/errors.js";

/**
 * Input for the search_docs tool.
 */
export interface SearchDocsInput {
  /** The docs ID from index_docs response */
  docs_id: string;
  /** Search query */
  query: string;
  /** Max results to return (default: 10) */
  limit?: number;
}

/**
 * Output for the search_docs tool.
 */
export interface SearchDocsOutput {
  /** The docs ID that was searched */
  docs_id: string;
  /** The query that was executed */
  query: string;
  /** Search results with snippets */
  results: SearchResult[];
}

/**
 * Default limit for search results.
 */
const DEFAULT_LIMIT = 10;

/**
 * Maximum allowed limit for search results.
 */
const MAX_LIMIT = 50;

/**
 * Searches within cached documentation using full-text search.
 */
export async function searchDocs(
  input: SearchDocsInput
): Promise<SearchDocsOutput> {
  const { docs_id, query, limit = DEFAULT_LIMIT } = input;

  // Validate required parameters
  if (!docs_id) {
    throw new ValidationError("Missing required parameter: docs_id", "docs_id");
  }

  if (!query || typeof query !== "string") {
    throw new ValidationError("Missing required parameter: query", "query");
  }

  // Validate limit
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Find the cached docs entry to determine source type
  const meta = await cacheManager.findById(docs_id);
  if (!meta) {
    throw new CacheNotFoundError(docs_id);
  }

  // Load the search index
  const indexJson = await cacheManager.getSearchIndex(meta.source, docs_id);
  if (!indexJson) {
    throw new DocsError("CACHE_NOT_FOUND", `Search index not found for "${docs_id}"`, {
      userMessage: `Search index not found for "${docs_id}". Please re-index the documentation.`,
      suggestions: ["Run index_docs with force_refresh: true to rebuild the search index"],
      context: { docs_id },
    });
  }

  // Parse and search
  let searchIndex: SearchIndex;
  try {
    searchIndex = SearchIndex.fromJSON(indexJson);
  } catch (error) {
    throw new DocsError("PARSE_ERROR", "Failed to load search index", {
      userMessage: "Search index is corrupted. Please re-index the documentation.",
      suggestions: ["Run index_docs with force_refresh: true to rebuild the search index"],
      context: { docs_id },
      cause: error instanceof Error ? error : undefined,
    });
  }

  // Perform the search
  const results = searchIndex.search(query, effectiveLimit);

  return {
    docs_id,
    query,
    results,
  };
}

