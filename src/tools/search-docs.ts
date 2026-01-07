/**
 * search_docs tool - Full-text search within cached documentation.
 */

import { cacheManager } from "../services/cache-manager.js";
import { SearchIndex, type SearchResult } from "../services/search-index.js";

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
    throw new Error("Missing required parameter: docs_id");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Missing required parameter: query");
  }

  // Validate limit
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Find the cached docs entry to determine source type
  const meta = await cacheManager.findById(docs_id);
  if (!meta) {
    throw new Error(`Documentation not found in cache: "${docs_id}"`);
  }

  // Load the search index
  const indexJson = await cacheManager.getSearchIndex(meta.source, docs_id);
  if (!indexJson) {
    throw new Error(
      `Search index not found for "${docs_id}". Please re-index the documentation.`
    );
  }

  // Parse and search
  let searchIndex: SearchIndex;
  try {
    searchIndex = SearchIndex.fromJSON(indexJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to load search index: ${message}`);
  }

  // Perform the search
  const results = searchIndex.search(query, effectiveLimit);

  return {
    docs_id,
    query,
    results,
  };
}

