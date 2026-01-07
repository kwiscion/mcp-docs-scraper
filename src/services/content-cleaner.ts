/**
 * Content Cleaner Service - Converts HTML to clean Markdown.
 *
 * Responsibilities:
 * - Remove unwanted elements (nav, script, style, etc.)
 * - Extract main content from the page
 * - Convert HTML to Markdown with Turndown
 * - Preserve code blocks with language hints
 * - Convert relative URLs to absolute
 */

import TurndownService from "turndown";
import * as cheerio from "cheerio";

/**
 * Options for the content cleaner.
 */
export interface ContentCleanerOptions {
  /** Base URL for resolving relative links */
  baseUrl?: string;
  /** Whether to extract only the main content area */
  extractMainContent?: boolean;
}

/**
 * Result of cleaning HTML content.
 */
export interface CleanedContent {
  /** The cleaned Markdown content */
  markdown: string;
  /** Extracted title from the page */
  title?: string;
  /** List of headings found in the content */
  headings: Array<{ level: number; text: string }>;
}

/**
 * Elements to remove completely from the DOM.
 */
const ELEMENTS_TO_REMOVE = [
  "script",
  "style",
  "noscript",
  "iframe",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  ".nav",
  ".navbar",
  ".navigation",
  ".sidebar",
  ".menu",
  ".footer",
  ".header",
  ".ads",
  ".advertisement",
  ".social-share",
  ".comments",
  ".comment",
  ".breadcrumb",
  ".breadcrumbs",
  ".pagination",
  "[role='navigation']",
  "[role='banner']",
  "[role='complementary']",
  "[role='contentinfo']",
];

/**
 * Selectors for main content extraction (in priority order).
 */
const MAIN_CONTENT_SELECTORS = [
  "main",
  "article",
  "[role='main']",
  ".content",
  ".documentation",
  ".docs",
  ".doc-content",
  ".markdown-body",
  ".post-content",
  ".article-content",
  "#content",
  "#main",
  "#main-content",
  ".main-content",
];

/**
 * Creates a configured Turndown service for HTML to Markdown conversion.
 */
function createTurndownService(baseUrl?: string): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx", // # style headings
    codeBlockStyle: "fenced", // ``` code blocks
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Remove unwanted elements completely
  turndown.remove(["script", "style", "noscript", "iframe"]);

  // Preserve code block language hints
  turndown.addRule("fencedCodeBlock", {
    filter: (node) => {
      return (
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement: (_content, node) => {
      const pre = node as HTMLPreElement;
      const code = pre.querySelector("code");
      if (!code) return "";

      // Try to extract language from class
      const classList = code.className || "";
      const langMatch = classList.match(/(?:language-|lang-)(\w+)/);
      const lang = langMatch ? langMatch[1] : "";

      // Get the text content and preserve it
      const text = code.textContent || "";

      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    },
  });

  // Handle inline code
  turndown.addRule("inlineCode", {
    filter: (node) => {
      return (
        node.nodeName === "CODE" &&
        node.parentNode !== null &&
        node.parentNode.nodeName !== "PRE"
      );
    },
    replacement: (content) => {
      if (!content) return "";
      // Escape backticks in the content
      const escaped = content.replace(/`/g, "\\`");
      return `\`${escaped}\``;
    },
  });

  // Convert relative URLs to absolute for links
  if (baseUrl) {
    turndown.addRule("absoluteLinks", {
      filter: "a",
      replacement: (content, node) => {
        const element = node as HTMLAnchorElement;
        const href = element.getAttribute("href");

        if (!href || !content.trim()) {
          return content;
        }

        // Skip anchor-only links
        if (href.startsWith("#")) {
          return `[${content}](${href})`;
        }

        // Convert relative URLs to absolute
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          return `[${content}](${absoluteUrl})`;
        } catch {
          // If URL is invalid, return as-is
          return `[${content}](${href})`;
        }
      },
    });
  }

  // Convert relative URLs to absolute for images
  if (baseUrl) {
    turndown.addRule("absoluteImages", {
      filter: "img",
      replacement: (_content, node) => {
        const element = node as HTMLImageElement;
        const src = element.getAttribute("src");
        const alt = element.getAttribute("alt") || "";

        if (!src) {
          return "";
        }

        // Convert relative URLs to absolute
        try {
          const absoluteUrl = new URL(src, baseUrl).href;
          return `![${alt}](${absoluteUrl})`;
        } catch {
          return `![${alt}](${src})`;
        }
      },
    });
  }

  return turndown;
}

/**
 * Extracts the main content area from an HTML document.
 */
function extractMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element> | null {
  // Try each selector in priority order
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const element = $(selector).first();
    if (element.length > 0) {
      return element;
    }
  }

  // Fallback: find the element with the most text content
  let bestElement: cheerio.Cheerio<cheerio.Element> | null = null;
  let maxTextLength = 0;

  $("div, section").each((_, elem) => {
    const $elem = $(elem);
    const textLength = $elem.text().trim().length;

    if (textLength > maxTextLength) {
      maxTextLength = textLength;
      bestElement = $elem;
    }
  });

  return bestElement;
}

/**
 * Extracts the page title from HTML.
 */
function extractTitle($: cheerio.CheerioAPI): string | undefined {
  // Try <title> tag first
  const titleTag = $("title").first().text().trim();
  if (titleTag) {
    // Clean up common suffixes
    const cleaned = titleTag
      .replace(/\s*[|\-–—]\s*.+$/, "") // Remove " | Site Name" or " - Site Name"
      .trim();
    if (cleaned) return cleaned;
  }

  // Try <h1> tag
  const h1 = $("h1").first().text().trim();
  if (h1) return h1;

  // Try og:title meta tag
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle) return ogTitle.trim();

  return undefined;
}

/**
 * Extracts headings from Markdown content.
 */
function extractHeadings(markdown: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }

  return headings;
}

/**
 * Normalizes markdown output for cleaner results.
 */
function normalizeMarkdown(markdown: string): string {
  return (
    markdown
      // Remove excessive blank lines (more than 2 in a row)
      .replace(/\n{3,}/g, "\n\n")
      // Remove trailing whitespace from lines
      .replace(/[ \t]+$/gm, "")
      // Ensure single newline at end
      .trim() + "\n"
  );
}

/**
 * Cleans HTML content and converts it to Markdown.
 *
 * @param html The raw HTML content
 * @param options Cleaning options
 * @returns Cleaned markdown content with metadata
 */
export function cleanHtml(
  html: string,
  options: ContentCleanerOptions = {}
): CleanedContent {
  const { baseUrl, extractMainContent: shouldExtractMain = true } = options;

  // Parse HTML with Cheerio
  const $ = cheerio.load(html);

  // Extract title before removing elements
  const title = extractTitle($);

  // Remove unwanted elements
  for (const selector of ELEMENTS_TO_REMOVE) {
    $(selector).remove();
  }

  // Get the content to convert
  let contentHtml: string;

  if (shouldExtractMain) {
    const mainContent = extractMainContent($);
    if (mainContent) {
      contentHtml = mainContent.html() || "";
    } else {
      // Fallback to body content
      contentHtml = $("body").html() || html;
    }
  } else {
    contentHtml = $("body").html() || html;
  }

  // Convert to Markdown
  const turndown = createTurndownService(baseUrl);
  let markdown = turndown.turndown(contentHtml);

  // Normalize the output
  markdown = normalizeMarkdown(markdown);

  // Extract headings from the final markdown
  const headings = extractHeadings(markdown);

  return {
    markdown,
    title,
    headings,
  };
}

/**
 * Content cleaner singleton for convenience.
 */
export const contentCleaner = {
  clean: cleanHtml,
};

