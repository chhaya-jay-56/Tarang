/**
 * RobinRank client & article storage module.
 *
 * Supports both:
 * 1. Webhook pushing (receives auto-published articles via /api/webhooks/robinrank)
 * 2. REST API pulling (fetches from RobinRank API using ROBINRANK_API_KEY)
 */

import { Redis } from "@upstash/redis";

const ROBINRANK_API_URL = "https://www.robinrank.ai/api/v1/articles";
const REDIS_KEY = "robinrank:articles";

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

// In-memory fallback cache if Upstash Redis env vars are not set
const memoryCache = new Map<string, RobinRankArticle>();

function getRedisClient(): Redis | null {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      return Redis.fromEnv();
    } catch (e) {
      console.warn("[RobinRank] Upstash Redis initialization error:", e);
    }
  }
  return null;
}

/**
 * Store or update an article received via Webhook.
 */
export async function storeArticleInRedis(article: RobinRankArticle): Promise<void> {
  // Store in memory fallback
  memoryCache.set(article.slug, article);

  const redis = getRedisClient();
  if (redis) {
    try {
      const existingArticlesRaw = (await redis.get<RobinRankArticle[]>(REDIS_KEY)) || [];
      const articlesMap = new Map<string, RobinRankArticle>();

      existingArticlesRaw.forEach((item) => {
        if (item.slug) articlesMap.set(item.slug, item);
      });

      // Update or add the new article
      articlesMap.set(article.slug, article);

      const updatedList = Array.from(articlesMap.values());
      await redis.set(REDIS_KEY, JSON.stringify(updatedList));
      console.log(`[RobinRank] Article stored in Redis: ${article.slug}`);
    } catch (err) {
      console.error("[RobinRank] Failed to save article to Upstash Redis:", err);
    }
  }
}

/**
 * Fetch all published articles.
 * Checks Redis/Webhook cache first, then falls back to RobinRank REST API.
 */
export async function fetchArticles(): Promise<RobinRankArticle[]> {
  let webhookArticles: RobinRankArticle[] = [];

  // 1. Try Redis cache
  const redis = getRedisClient();
  if (redis) {
    try {
      const data = await redis.get<string | RobinRankArticle[]>(REDIS_KEY);
      if (data) {
        webhookArticles = typeof data === "string" ? JSON.parse(data) : data;
      }
    } catch (err) {
      console.error("[RobinRank] Redis read error:", err);
    }
  }

  // Add memory cache articles if any
  if (memoryCache.size > 0) {
    const memList = Array.from(memoryCache.values());
    const mergedMap = new Map<string, RobinRankArticle>();
    webhookArticles.forEach((a) => mergedMap.set(a.slug, a));
    memList.forEach((a) => mergedMap.set(a.slug, a));
    webhookArticles = Array.from(mergedMap.values());
  }

  if (webhookArticles.length > 0) {
    return webhookArticles.filter((a) => a.status === "published" || !a.status);
  }

  // 2. Fallback to RobinRank REST API if no webhook articles yet
  const apiKey = process.env.ROBINRANK_API_KEY;
  if (!apiKey) {
    console.warn("[RobinRank] No Webhook articles found and ROBINRANK_API_KEY not set.");
    return [];
  }

  try {
    const res = await fetch(ROBINRANK_API_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`[RobinRank] API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const articles: RobinRankArticle[] = Array.isArray(data)
      ? data
      : data.articles ?? data.data ?? [];

    return articles.filter((a) => a.status === "published" || !a.status);
  } catch (error) {
    console.error("[RobinRank] Failed to fetch articles from REST API:", error);
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
