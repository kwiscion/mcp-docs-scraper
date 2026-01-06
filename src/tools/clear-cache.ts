import { cacheManager } from "../services/cache-manager.js";

/**
 * Input type for clear_cache tool.
 */
export interface ClearCacheInput {
  /** Specific docs ID to clear (optional) */
  docs_id?: string;
  /** Clear all cached docs (default: false) */
  all?: boolean;
}

/**
 * Output type for clear_cache tool.
 */
export interface ClearCacheOutput {
  /** IDs that were cleared */
  cleared: string[];
  /** Count of remaining cached docs */
  remaining: number;
}

/**
 * Removes cached documentation.
 * Either clears a specific docs entry by ID, or all entries if `all` is true.
 */
export async function clearCache(input: ClearCacheInput): Promise<ClearCacheOutput> {
  await cacheManager.initialize();

  const cleared: string[] = [];

  if (input.all) {
    // Clear everything
    const allCleared = await cacheManager.clearAll();
    cleared.push(...allCleared);
  } else if (input.docs_id) {
    // Clear specific entry - try both sources
    const meta = await cacheManager.findById(input.docs_id);
    if (meta) {
      await cacheManager.clearEntry(meta.source, meta.id);
      cleared.push(meta.id);
    }
  }

  // Count remaining entries
  const remaining = (await cacheManager.listEntries()).length;

  return {
    cleared,
    remaining,
  };
}

