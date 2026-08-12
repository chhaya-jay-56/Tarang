import { marked } from "marked";

/**
 * Converts raw article content (Markdown or HTML) into clean, structured HTML.
 * Handles Table of Contents, headings, lists, images, blockquotes, and links cleanly.
 */
export function renderMarkdownToHtml(content: string): string {
  if (!content) return "";

  // Configure marked to support GitHub Flavored Markdown and automatic line breaks
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  try {
    let rawHtml = marked.parse(content) as string;

    // Enhance Table of Contents if present in generated HTML
    // Wrap TOC lists in a styled card
    rawHtml = rawHtml.replace(
      /(<h[23][^>]*>.*?(?:Table of Contents|Contents).*?<\/h[23]>\s*)(<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/gi,
      (_match, header, list) => {
        return `<div class="tocContainer">${header}${list}</div>`;
      }
    );

    return rawHtml;
  } catch (error) {
    console.error("[MarkdownParser] Error parsing content:", error);
    return content;
  }
}
