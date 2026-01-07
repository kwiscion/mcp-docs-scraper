/**
 * detect_github_repo tool - Finds GitHub repository from a docs website URL.
 */

import {
  detectGitHubRepo,
  type GitHubDetectionResult,
} from "../services/github-detector.js";

/**
 * Input for the detect_github_repo tool.
 */
export interface DetectGitHubInput {
  /** Docs website URL to analyze */
  url: string;
}

/**
 * Output from the detect_github_repo tool.
 * Same as GitHubDetectionResult.
 */
export type DetectGitHubOutput = GitHubDetectionResult;

/**
 * Detects GitHub repository from a documentation website URL.
 */
export async function detectGitHub(
  input: DetectGitHubInput
): Promise<DetectGitHubOutput> {
  const { url } = input;

  // Validate required parameters
  if (!url) {
    throw new Error("Missing required parameter: url");
  }

  // Run detection
  return detectGitHubRepo(url);
}

