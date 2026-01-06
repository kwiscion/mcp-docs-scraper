/**
 * Rate limit tracker for GitHub API.
 */

export interface RateLimitInfo {
  /** Maximum requests allowed per hour */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when rate limit resets */
  reset: number;
  /** When this info was last updated */
  updatedAt: Date;
}

/**
 * Tracks GitHub API rate limits.
 */
export class RateLimitTracker {
  private info: RateLimitInfo | null = null;

  /**
   * Updates rate limit info from response headers.
   */
  updateFromHeaders(headers: Headers): void {
    const limit = headers.get("X-RateLimit-Limit");
    const remaining = headers.get("X-RateLimit-Remaining");
    const reset = headers.get("X-RateLimit-Reset");

    if (limit && remaining && reset) {
      this.info = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Gets the current rate limit info.
   */
  getInfo(): RateLimitInfo | null {
    return this.info;
  }

  /**
   * Checks if we're running low on remaining requests.
   * @param threshold Number of remaining requests to consider "low"
   */
  isLow(threshold: number = 5): boolean {
    if (!this.info) return false;
    return this.info.remaining < threshold;
  }

  /**
   * Checks if rate limit is exhausted.
   */
  isExhausted(): boolean {
    if (!this.info) return false;
    return this.info.remaining <= 0;
  }

  /**
   * Gets time until rate limit resets (in milliseconds).
   * Returns 0 if reset time has passed or no info available.
   */
  getTimeUntilReset(): number {
    if (!this.info) return 0;
    const resetTime = this.info.reset * 1000; // Convert to ms
    const now = Date.now();
    return Math.max(0, resetTime - now);
  }

  /**
   * Gets a human-readable status message.
   */
  getStatusMessage(): string {
    if (!this.info) {
      return "Rate limit info not available";
    }

    const resetDate = new Date(this.info.reset * 1000);
    const minutesUntilReset = Math.ceil(this.getTimeUntilReset() / 60000);

    if (this.isExhausted()) {
      return `Rate limit exhausted. Resets in ${minutesUntilReset} minutes.`;
    }

    if (this.isLow()) {
      return `Rate limit low: ${this.info.remaining}/${this.info.limit} remaining. Resets in ${minutesUntilReset} minutes.`;
    }

    return `Rate limit: ${this.info.remaining}/${this.info.limit} remaining`;
  }
}

/**
 * Default rate limit tracker instance for GitHub API.
 */
export const githubRateLimit = new RateLimitTracker();

