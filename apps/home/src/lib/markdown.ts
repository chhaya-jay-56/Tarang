import { marked } from "marked";

/**
 * Converts raw article content (Markdown or HTML) into clean, structured HTML.
 * Handles Table of Contents, headings, lists, images, blockquotes, tables, and links cleanly.
 */
export function renderMarkdownToHtml(content: string, articleTitle?: string): string {
  if (!content) return "";

  // Remove leading duplicate H1 heading if it mirrors the article title
  let cleanedContent = content;
  if (articleTitle) {
    const escapedTitle = articleTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const h1Regex = new RegExp(`^\\s*#\\s+${escapedTitle}\\s*\\n+`, "i");
    cleanedContent = cleanedContent.replace(h1Regex, "");
  }

  // Configure marked to support GitHub Flavored Markdown and automatic line breaks
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  try {
    let rawHtml = marked.parse(cleanedContent) as string;

    // Enhance Table of Contents if present in generated HTML
    // Wrap TOC lists in a styled card
    rawHtml = rawHtml.replace(
      /(<h[23][^>]*>.*?(?:Table of Contents|Contents|Outline).*?<\/h[23]>\s*)(<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/gi,
      (_match, header, list) => {
        return `<div class="tocContainer">${header}${list}</div>`;
      }
    );

    // Wrap tables in responsive container
    rawHtml = rawHtml.replace(
      /(<table[\s\S]*?<\/table>)/gi,
      '<div class="tableWrapper">$1</div>'
    );

    return rawHtml;
  } catch (error) {
    console.error("[MarkdownParser] Error parsing content:", error);
    return content;
  }
}

