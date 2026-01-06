import { cacheManager } from "../services/cache-manager.js";

/**
 * Output type for list_cached_docs tool.
 */
export interface ListCachedDocsOutput {
  docs: Array<{
    id: string;
    source: "github" | "scraped";
    repo?: string;
    base_url?: string;
    indexed_at: string;
    page_count: number;
    total_size_bytes: number;
  }>;
}

/**
 * Lists all documentation sets in the local cache.
 */
export async function listCachedDocs(): Promise<ListCachedDocsOutput> {
  await cacheManager.initialize();
  const entries = await cacheManager.listEntries();

  return {
    docs: entries.map((entry) => ({
      id: entry.id,
      source: entry.source,
      repo: entry.repo,
      base_url: entry.base_url,
      indexed_at: entry.indexed_at,
      page_count: entry.page_count,
      total_size_bytes: entry.total_size_bytes,
    })),
  };
}
