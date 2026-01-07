import { join } from "node:path";
import type { CacheMeta, CacheEntrySummary } from "../types/cache.js";
import {
  CACHE_DIR,
  ensureDir,
  readJson,
  writeJson,
  readText,
  writeText,
  remove,
  listDirectories,
  exists,
} from "../utils/fs.js";

/** Default TTL for GitHub-sourced docs (7 days) */
const GITHUB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Default TTL for scraped docs (24 hours) */
const SCRAPED_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Manages the local documentation cache.
 * Handles storing, retrieving, listing, and clearing cached docs.
 */
export class CacheManager {
  private readonly cacheDir: string;

  constructor(cacheDir: string = CACHE_DIR) {
    this.cacheDir = cacheDir;
  }

  /**
   * Gets the root cache directory path.
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Initializes the cache directory structure.
   */
  async initialize(): Promise<void> {
    await ensureDir(join(this.cacheDir, "github"));
    await ensureDir(join(this.cacheDir, "scraped"));
  }

  /**
   * Gets the directory path for a specific docs entry.
   */
  private getEntryDir(source: "github" | "scraped", id: string): string {
    return join(this.cacheDir, source, id);
  }

  /**
   * Gets the meta.json file path for a docs entry.
   */
  private getMetaPath(source: "github" | "scraped", id: string): string {
    return join(this.getEntryDir(source, id), "meta.json");
  }

  /**
   * Gets the content directory path for a docs entry.
   */
  private getContentDir(source: "github" | "scraped", id: string): string {
    return join(this.getEntryDir(source, id), "content");
  }

  /**
   * Gets the search index file path for a docs entry.
   */
  private getSearchIndexPath(source: "github" | "scraped", id: string): string {
    return join(this.getEntryDir(source, id), "search-index.json");
  }

  /**
   * Generates an expiration timestamp based on source type.
   */
  private getExpiresAt(source: "github" | "scraped"): string {
    const ttl = source === "github" ? GITHUB_TTL_MS : SCRAPED_TTL_MS;
    return new Date(Date.now() + ttl).toISOString();
  }

  /**
   * Stores metadata for a docs entry.
   */
  async storeMeta(meta: Omit<CacheMeta, "expires_at"> & { expires_at?: string }): Promise<void> {
    const fullMeta: CacheMeta = {
      ...meta,
      expires_at: meta.expires_at ?? this.getExpiresAt(meta.source),
    };
    await writeJson(this.getMetaPath(meta.source, meta.id), fullMeta);
  }

  /**
   * Retrieves metadata for a docs entry.
   * Returns null if not found.
   */
  async getMeta(source: "github" | "scraped", id: string): Promise<CacheMeta | null> {
    return readJson<CacheMeta>(this.getMetaPath(source, id));
  }

  /**
   * Stores content for a specific file path within a docs entry.
   */
  async storeContent(
    source: "github" | "scraped",
    id: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const contentPath = join(this.getContentDir(source, id), filePath);
    await writeText(contentPath, content);
  }

  /**
   * Retrieves content for a specific file path within a docs entry.
   * Returns null if not found.
   */
  async getContent(
    source: "github" | "scraped",
    id: string,
    filePath: string
  ): Promise<string | null> {
    const contentPath = join(this.getContentDir(source, id), filePath);
    return readText(contentPath);
  }

  /**
   * Stores a search index for a docs entry.
   */
  async storeSearchIndex(
    source: "github" | "scraped",
    id: string,
    indexJson: string
  ): Promise<void> {
    const indexPath = this.getSearchIndexPath(source, id);
    await writeText(indexPath, indexJson);
  }

  /**
   * Retrieves a search index for a docs entry.
   * Returns null if not found.
   */
  async getSearchIndex(
    source: "github" | "scraped",
    id: string
  ): Promise<string | null> {
    const indexPath = this.getSearchIndexPath(source, id);
    return readText(indexPath);
  }

  /**
   * Checks if a search index exists for a docs entry.
   */
  async hasSearchIndex(
    source: "github" | "scraped",
    id: string
  ): Promise<boolean> {
    return exists(this.getSearchIndexPath(source, id));
  }

  /**
   * Checks if a docs entry exists in the cache.
   */
  async hasEntry(source: "github" | "scraped", id: string): Promise<boolean> {
    return exists(this.getMetaPath(source, id));
  }

  /**
   * Lists all cached docs entries.
   */
  async listEntries(): Promise<CacheEntrySummary[]> {
    const entries: CacheEntrySummary[] = [];

    // List GitHub entries
    const githubDirs = await listDirectories(join(this.cacheDir, "github"));
    for (const id of githubDirs) {
      const meta = await this.getMeta("github", id);
      if (meta) {
        entries.push({
          id: meta.id,
          source: meta.source,
          repo: meta.repo,
          indexed_at: meta.indexed_at,
          page_count: meta.page_count,
          total_size_bytes: meta.total_size_bytes,
        });
      }
    }

    // List scraped entries
    const scrapedDirs = await listDirectories(join(this.cacheDir, "scraped"));
    for (const id of scrapedDirs) {
      const meta = await this.getMeta("scraped", id);
      if (meta) {
        entries.push({
          id: meta.id,
          source: meta.source,
          base_url: meta.base_url,
          indexed_at: meta.indexed_at,
          page_count: meta.page_count,
          total_size_bytes: meta.total_size_bytes,
        });
      }
    }

    return entries;
  }

  /**
   * Clears a specific docs entry from the cache.
   */
  async clearEntry(source: "github" | "scraped", id: string): Promise<boolean> {
    const entryDir = this.getEntryDir(source, id);
    if (await exists(entryDir)) {
      await remove(entryDir);
      return true;
    }
    return false;
  }

  /**
   * Clears all entries from the cache.
   */
  async clearAll(): Promise<string[]> {
    const cleared: string[] = [];

    // Clear GitHub entries
    const githubDirs = await listDirectories(join(this.cacheDir, "github"));
    for (const id of githubDirs) {
      await this.clearEntry("github", id);
      cleared.push(id);
    }

    // Clear scraped entries
    const scrapedDirs = await listDirectories(join(this.cacheDir, "scraped"));
    for (const id of scrapedDirs) {
      await this.clearEntry("scraped", id);
      cleared.push(id);
    }

    return cleared;
  }

  /**
   * Checks if a cache entry has expired.
   */
  isExpired(meta: CacheMeta): boolean {
    return new Date(meta.expires_at) < new Date();
  }

  /**
   * Finds a docs entry by ID, checking both github and scraped sources.
   * Returns null if not found.
   */
  async findById(id: string): Promise<CacheMeta | null> {
    // Try GitHub first
    const githubMeta = await this.getMeta("github", id);
    if (githubMeta) return githubMeta;

    // Try scraped
    const scrapedMeta = await this.getMeta("scraped", id);
    if (scrapedMeta) return scrapedMeta;

    return null;
  }
}

/**
 * Default cache manager instance.
 */
export const cacheManager = new CacheManager();

