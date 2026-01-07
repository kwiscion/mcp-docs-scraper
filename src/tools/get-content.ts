/**
 * get_docs_content tool - Retrieves actual content of specific doc files from cache.
 */

import { cacheManager } from "../services/cache-manager.js";

/**
 * Input parameters for get_docs_content tool.
 */
export interface GetDocsContentInput {
  /** The docs ID from index_docs response */
  docs_id: string;
  /** Array of file paths to fetch */
  paths: string[];
  /** Output format (default: markdown) */
  format?: "markdown" | "raw";
}

/**
 * Content information for a single file.
 */
export interface FileContent {
  /** The actual content */
  content: string;
  /** Extracted title (first H1 heading) */
  title?: string;
  /** List of headings for quick navigation */
  headings: string[];
  /** Size in bytes */
  size_bytes: number;
}

/**
 * Output from get_docs_content tool.
 */
export interface GetDocsContentOutput {
  /** The docs ID */
  docs_id: string;
  /** Content for each found path */
  contents: Record<string, FileContent>;
  /** Paths that don't exist in cache */
  not_found: string[];
}

/**
 * Extracts headings from markdown content.
 * Returns an array of heading text (without the # prefix).
 */
function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match markdown headings (# to ######)
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Include heading level for context
      headings.push(`${"#".repeat(level)} ${text}`);
    }
  }

  return headings;
}

/**
 * Extracts the title from markdown content.
 * Returns the first H1 heading, or undefined if none found.
 */
function extractTitle(content: string): string | undefined {
  const lines = content.split("\n");

  for (const line of lines) {
    // Match H1 heading
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Gets the content of specific files from cached documentation.
 */
export async function getDocsContent(
  input: GetDocsContentInput
): Promise<GetDocsContentOutput> {
  const { docs_id, paths, format = "markdown" } = input;

  // Validate required parameters
  if (!docs_id) {
    throw new Error("Missing required parameter: docs_id");
  }

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    throw new Error("Missing required parameter: paths (must be a non-empty array of file paths)");
  }

  // Find the cached docs entry to determine source type
  const meta = await cacheManager.findById(docs_id);

  if (!meta) {
    throw new Error(
      `Documentation not found in cache: "${docs_id}". Run index_docs first.`
    );
  }

  const contents: Record<string, FileContent> = {};
  const not_found: string[] = [];

  // Fetch each requested path
  for (const path of paths) {
    // Normalize path (remove leading slash if present)
    const normalizedPath = path.replace(/^\/+/, "");

    const content = await cacheManager.getContent(
      meta.source,
      docs_id,
      normalizedPath
    );

    if (content === null) {
      not_found.push(path);
    } else {
      const headings = extractHeadings(content);
      const title = extractTitle(content);

      contents[path] = {
        content: format === "raw" ? content : content,
        title,
        headings,
        size_bytes: new TextEncoder().encode(content).length,
      };
    }
  }

  return {
    docs_id,
    contents,
    not_found,
  };
}

