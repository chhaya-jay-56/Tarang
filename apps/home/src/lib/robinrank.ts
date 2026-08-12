/**
 * RobinRank API client for fetching blog articles.
 *
 * Set ROBINRANK_API_KEY in your environment variables.
 * Articles are fetched server-side and cached via Next.js ISR.
 */

const ROBINRANK_API_URL = "https://www.robinrank.ai/api/v1/articles";

export interface RobinRankArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  meta_title?: string;
  meta_description?: string;
  featured_image?: string;
  status?: string;
  tags?: string[];
}

/**
 * Fetch all published articles from RobinRank.
 * Revalidates every 1 hour (3600s) via ISR.
 */
export async function fetchArticles(): Promise<RobinRankArticle[]> {
  const apiKey = process.env.ROBINRANK_API_KEY;

  if (!apiKey) {
    console.warn("[RobinRank] ROBINRANK_API_KEY not set — returning empty articles.");
    return [];
  }

  try {
    const res = await fetch(ROBINRANK_API_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 }, // ISR: revalidate every hour
    });

    if (!res.ok) {
      console.error(`[RobinRank] API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();

    // RobinRank may return { articles: [...] } or just [...]
    const articles: RobinRankArticle[] = Array.isArray(data)
      ? data
      : data.articles ?? data.data ?? [];

    return articles.filter(
      (a) => a.status === "published" || !a.status
    );
  } catch (error) {
    console.error("[RobinRank] Failed to fetch articles:", error);
    return [];
  }
}

/**
 * Fetch a single article by slug.
 */
export async function fetchArticleBySlug(
  slug: string
): Promise<RobinRankArticle | null> {
  const articles = await fetchArticles();
  return articles.find((a) => a.slug === slug) ?? null;
}

/**
 * Generate a plain-text excerpt from HTML content.
 */
export function generateExcerpt(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength
    ? text.slice(0, maxLength).trimEnd() + "…"
    : text;
}
