/**
 * Represents a node in the documentation tree structure.
 */
export interface DocsTreeNode {
  /** File or folder name */
  name: string;
  /** Full path from root */
  path: string;
  /** Node type */
  type: "file" | "folder";
  /** File size in bytes (for files only) */
  size_bytes?: number;
  /** Child nodes (for folders only) */
  children?: DocsTreeNode[];
}

/**
 * Metadata stored for each cached documentation set.
 */
export interface CacheMeta {
  /** Unique identifier for this docs set */
  id: string;
  /** Source type */
  source: "github" | "scraped";

  // For GitHub sources
  /** Repository in "owner/repo" format */
  repo?: string;
  /** Branch name */
  branch?: string;

  // For scraped sources
  /** Base URL of the scraped documentation */
  base_url?: string;

  // Common fields
  /** ISO timestamp when docs were indexed */
  indexed_at: string;
  /** ISO timestamp when cache expires */
  expires_at: string;
  /** Number of pages/files in the docs */
  page_count: number;
  /** Total size of all content in bytes */
  total_size_bytes: number;

  /** Hierarchical file tree */
  tree: DocsTreeNode[];
}

/**
 * Summary information about a cached docs entry (for listing).
 */
export interface CacheEntrySummary {
  id: string;
  source: "github" | "scraped";
  repo?: string;
  base_url?: string;
  indexed_at: string;
  page_count: number;
  total_size_bytes: number;
}

