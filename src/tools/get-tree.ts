/**
 * get_docs_tree tool - Retrieves the file tree for cached documentation.
 */

import type { DocsTreeNode } from "../types/cache.js";
import { cacheManager } from "../services/cache-manager.js";
import { CacheNotFoundError, ValidationError } from "../types/errors.js";

/**
 * Input parameters for get_docs_tree tool.
 */
export interface GetDocsTreeInput {
  /** The docs ID from index_docs response */
  docs_id: string;
  /** Subtree path to filter (optional, default: root) */
  path?: string;
  /** Maximum depth to return (optional, default: unlimited) */
  max_depth?: number;
}

/**
 * Output from get_docs_tree tool.
 */
export interface GetDocsTreeOutput {
  /** The docs ID */
  docs_id: string;
  /** The path being returned */
  path: string;
  /** The tree structure */
  tree: DocsTreeNode[];
}

/**
 * Finds a subtree at the given path within a tree structure.
 * Returns the children of the node at the given path, or null if not found.
 */
function findSubtree(tree: DocsTreeNode[], targetPath: string): DocsTreeNode[] | null {
  // Normalize path (remove leading/trailing slashes)
  const normalizedPath = targetPath.replace(/^\/+|\/+$/g, "");

  if (!normalizedPath) {
    return tree; // Empty path returns root
  }

  // Search for the node at the target path
  function search(nodes: DocsTreeNode[]): DocsTreeNode[] | null {
    for (const node of nodes) {
      // Normalize node path for comparison
      const nodePath = node.path.replace(/^\/+|\/+$/g, "");

      if (nodePath === normalizedPath) {
        // Found the target node
        if (node.type === "folder" && node.children) {
          return node.children;
        }
        // If it's a file, return it as a single-element array
        return [node];
      }

      // Check if the target path is under this node
      if (normalizedPath.startsWith(nodePath + "/") && node.children) {
        const result = search(node.children);
        if (result) return result;
      }
    }
    return null;
  }

  return search(tree);
}

/**
 * Limits the depth of a tree structure.
 * depth=1 means only immediate children, depth=2 includes grandchildren, etc.
 */
function limitDepth(tree: DocsTreeNode[], maxDepth: number, currentDepth = 1): DocsTreeNode[] {
  if (maxDepth <= 0) {
    return [];
  }

  return tree.map((node) => {
    if (node.type === "folder" && node.children) {
      if (currentDepth >= maxDepth) {
        // Don't include children beyond max depth
        return {
          ...node,
          children: undefined,
        };
      }
      return {
        ...node,
        children: limitDepth(node.children, maxDepth, currentDepth + 1),
      };
    }
    return node;
  });
}

/**
 * Gets the documentation tree for a cached docs entry.
 */
export async function getDocsTree(input: GetDocsTreeInput): Promise<GetDocsTreeOutput> {
  const { docs_id, path = "", max_depth } = input;

  // Validate required parameters
  if (!docs_id) {
    throw new ValidationError("Missing required parameter: docs_id", "docs_id");
  }

  // Find the cached docs entry
  const meta = await cacheManager.findById(docs_id);

  if (!meta) {
    throw new CacheNotFoundError(docs_id);
  }

  // Get the tree (or subtree if path specified)
  let tree: DocsTreeNode[];

  if (path) {
    const subtree = findSubtree(meta.tree, path);
    if (!subtree) {
      throw new Error(
        `Path not found in documentation tree: "${path}". ` +
          `Use get_docs_tree without a path to see the full tree.`
      );
    }
    tree = subtree;
  } else {
    tree = meta.tree;
  }

  // Apply max_depth if specified
  if (max_depth !== undefined && max_depth > 0) {
    tree = limitDepth(tree, max_depth);
  }

  return {
    docs_id,
    path: path || "/",
    tree,
  };
}

