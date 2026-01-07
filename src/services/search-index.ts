/**
 * Search index service - Full-text search using MiniSearch.
 *
 * Indexes documentation content for fast searching.
 * Index is built during docs indexing and stored in cache.
 */

import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";

/**
 * Document to be indexed.
 */
export interface IndexableDocument {
  /** File path (unique identifier) */
  id: string;
  /** Document title (from first H1 or filename) */
  title: string;
  /** All headings concatenated */
  headings: string;
  /** Full text content */
  content: string;
}

/**
 * Search result with snippet.
 */
export interface SearchResult {
  /** File path */
  path: string;
  /** Document title */
  title: string;
  /** Matching excerpt with context */
  snippet: string;
  /** Relevance score (higher = more relevant) */
  score: number;
}

/**
 * Serialized index format for storage.
 */
export interface SerializedSearchIndex {
  /** MiniSearch serialized index */
  index: ReturnType<MiniSearch<IndexableDocument>["toJSON"]>;
  /** Document metadata for generating snippets */
  documents: Map<string, { title: string; content: string }>;
  /** Version for future compatibility */
  version: number;
}

// Current index version
const INDEX_VERSION = 1;

// Snippet configuration
const SNIPPET_LENGTH = 150;
const SNIPPET_CONTEXT = 50;

/**
 * Creates and manages a full-text search index for documentation.
 */
export class SearchIndex {
  private miniSearch: MiniSearch<IndexableDocument>;
  private documents: Map<string, { title: string; content: string }>;

  constructor() {
    this.miniSearch = new MiniSearch<IndexableDocument>({
      fields: ["title", "headings", "content"],
      storeFields: ["title"],
      searchOptions: {
        boost: { title: 3, headings: 2, content: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    this.documents = new Map();
  }

  /**
   * Adds a document to the index.
   */
  addDocument(doc: IndexableDocument): void {
    // Store document for snippet generation
    this.documents.set(doc.id, {
      title: doc.title,
      content: doc.content,
    });

    // Add to search index
    this.miniSearch.add(doc);
  }

  /**
   * Adds multiple documents to the index.
   */
  addDocuments(docs: IndexableDocument[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  /**
   * Searches the index and returns results with snippets.
   */
  search(query: string, limit: number = 10): SearchResult[] {
    if (!query.trim()) {
      return [];
    }

    const results = this.miniSearch.search(query, { limit });

    return results.map((result) => this.toSearchResult(result, query));
  }

  /**
   * Converts a MiniSearch result to our SearchResult format.
   */
  private toSearchResult(
    result: MiniSearchResult,
    query: string
  ): SearchResult {
    const doc = this.documents.get(result.id);
    const title = doc?.title || result.id;
    const content = doc?.content || "";

    return {
      path: result.id,
      title,
      snippet: this.generateSnippet(content, query),
      score: result.score,
    };
  }

  /**
   * Generates a snippet with the matching text highlighted.
   */
  private generateSnippet(content: string, query: string): string {
    if (!content) {
      return "";
    }

    // Find the best position to start the snippet
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let bestPosition = 0;
    let bestScore = 0;

    // Search for query terms and find the position with most matches
    for (const term of queryTerms) {
      if (term.length < 2) continue;

      const pos = contentLower.indexOf(term);
      if (pos !== -1) {
        // Score based on how early the term appears
        const score = 1 / (pos + 1);
        if (score > bestScore) {
          bestScore = score;
          bestPosition = pos;
        }
      }
    }

    // Calculate snippet boundaries
    const start = Math.max(0, bestPosition - SNIPPET_CONTEXT);
    const end = Math.min(content.length, start + SNIPPET_LENGTH);

    // Extract snippet
    let snippet = content.slice(start, end);

    // Clean up snippet
    snippet = snippet
      .replace(/\n+/g, " ") // Replace newlines with spaces
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Add ellipsis if needed
    if (start > 0) {
      snippet = "..." + snippet;
    }
    if (end < content.length) {
      snippet = snippet + "...";
    }

    return snippet;
  }

  /**
   * Returns the number of indexed documents.
   */
  get documentCount(): number {
    return this.documents.size;
  }

  /**
   * Serializes the index for storage.
   */
  toJSON(): string {
    const serialized: SerializedSearchIndex = {
      index: this.miniSearch.toJSON(),
      documents: this.documents,
      version: INDEX_VERSION,
    };

    // Convert Map to array for JSON serialization
    return JSON.stringify({
      ...serialized,
      documents: Array.from(this.documents.entries()),
    });
  }

  /**
   * Creates a SearchIndex from serialized JSON.
   */
  static fromJSON(json: string): SearchIndex {
    const parsed = JSON.parse(json);

    // Check version
    if (parsed.version !== INDEX_VERSION) {
      throw new Error(
        `Search index version mismatch: expected ${INDEX_VERSION}, got ${parsed.version}`
      );
    }

    const searchIndex = new SearchIndex();

    // Restore MiniSearch index
    searchIndex.miniSearch = MiniSearch.loadJSON(JSON.stringify(parsed.index), {
      fields: ["title", "headings", "content"],
      storeFields: ["title"],
      searchOptions: {
        boost: { title: 3, headings: 2, content: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    // Restore documents map
    searchIndex.documents = new Map(parsed.documents);

    return searchIndex;
  }

  /**
   * Clears the index.
   */
  clear(): void {
    this.miniSearch.removeAll();
    this.documents.clear();
  }
}

/**
 * Extracts a title from markdown content.
 * Returns the first H1 heading, or undefined if none found.
 */
export function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

/**
 * Extracts all headings from markdown content.
 * Returns a concatenated string of all headings.
 */
export function extractHeadings(content: string): string {
  const headings: string[] = [];
  const regex = /^#{1,6}\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    headings.push(match[1].trim());
  }

  return headings.join(" ");
}

/**
 * Creates an indexable document from file content.
 */
export function createIndexableDocument(
  path: string,
  content: string
): IndexableDocument {
  const title = extractTitle(content) || path.split("/").pop() || path;
  const headings = extractHeadings(content);

  return {
    id: path,
    title,
    headings,
    content,
  };
}

