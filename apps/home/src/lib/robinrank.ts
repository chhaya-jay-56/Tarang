/**
 * RobinRank client & article storage module.
 *
 * Supports both:
 * 1. Webhook pushing (receives auto-published articles via /api/webhooks/robinrank)
 * 2. REST API pulling (fetches from RobinRank API using ROBINRANK_API_KEY)
 * 3. Multi-tier persistence: Redis -> Filesystem (/tmp/robinrank_articles.json) -> Memory Map
 */

import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const ROBINRANK_API_URL = "https://www.robinrank.ai/api/v1/articles";
const REDIS_KEY = "robinrank:articles";
const TEMP_FILE_PATH = path.join("/tmp", "robinrank_articles.json");

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
  author?: string;
}

// In-memory fallback cache
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
 * Helper to read from local /tmp filesystem cache
 */
function readFromFileCache(): RobinRankArticle[] {
  try {
    if (fs.existsSync(TEMP_FILE_PATH)) {
      const data = fs.readFileSync(TEMP_FILE_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[RobinRank] File cache read error:", err);
  }
  return [];
}

/**
 * Helper to write to local /tmp filesystem cache
 */
function writeToFileCache(articles: RobinRankArticle[]): void {
  try {
    fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(articles, null, 2), "utf-8");
  } catch (err) {
    console.warn("[RobinRank] File cache write error:", err);
  }
}

/**
 * Store or update an article received via Webhook.
 */
export async function storeArticleInRedis(article: RobinRankArticle): Promise<void> {
  if (!article.slug) return;

  // 1. Store in memory cache
  memoryCache.set(article.slug, article);

  // 2. Store in filesystem cache
  const currentFileArticles = readFromFileCache();
  const fileMap = new Map<string, RobinRankArticle>();
  currentFileArticles.forEach((item) => {
    if (item.slug) fileMap.set(item.slug, item);
  });
  fileMap.set(article.slug, article);
  writeToFileCache(Array.from(fileMap.values()));

  // 3. Store in Upstash Redis if configured
  const redis = getRedisClient();
  if (redis) {
    try {
      const existingArticlesRaw = (await redis.get<RobinRankArticle[]>(REDIS_KEY)) || [];
      const articlesMap = new Map<string, RobinRankArticle>();

      existingArticlesRaw.forEach((item) => {
        if (item.slug) articlesMap.set(item.slug, item);
      });

      articlesMap.set(article.slug, article);

      const updatedList = Array.from(articlesMap.values());
      await redis.set(REDIS_KEY, JSON.stringify(updatedList));
      console.log(`[RobinRank] Article stored in Redis: ${article.slug}`);
    } catch (err) {
      console.error("[RobinRank] Failed to save article to Upstash Redis:", err);
    }
  }
}

function isPublishedStatus(status?: string): boolean {
  if (!status) return true;
  const s = String(status).toLowerCase().trim();
  return (
    s === "published" ||
    s === "publish" ||
    s === "active" ||
    s === "live" ||
    s === "true" ||
    s === "1"
  );
}

/**
 * Fetch all published articles.
 * Checks Redis -> Filesystem -> Memory cache first, then falls back to RobinRank REST API & Seed Articles.
 */
export async function fetchArticles(): Promise<RobinRankArticle[]> {
  const mergedMap = new Map<string, RobinRankArticle>();

  // 1. Try Redis cache
  const redis = getRedisClient();
  if (redis) {
    try {
      const data = await redis.get<string | RobinRankArticle[]>(REDIS_KEY);
      if (data) {
        const list: RobinRankArticle[] = typeof data === "string" ? JSON.parse(data) : data;
        list.forEach((a) => {
          if (a.slug) mergedMap.set(a.slug, a);
        });
      }
    } catch (err) {
      console.error("[RobinRank] Redis read error:", err);
    }
  }

  // 2. Add filesystem cache articles
  const fileArticles = readFromFileCache();
  fileArticles.forEach((a) => {
    if (a.slug) mergedMap.set(a.slug, a);
  });

  // 3. Add memory cache articles
  memoryCache.forEach((a, slug) => {
    mergedMap.set(slug, a);
  });

  let articles = Array.from(mergedMap.values());

  // 4. Fallback to RobinRank REST API if no webhook articles exist yet
  if (articles.length === 0) {
    const apiKey = process.env.ROBINRANK_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(ROBINRANK_API_URL, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          next: { revalidate: 300 },
        });

        if (res.ok) {
          const data = await res.json();
          const apiArticles: RobinRankArticle[] = Array.isArray(data)
            ? data
            : data.articles ?? data.data ?? [];

          apiArticles.forEach((a) => {
            if (a.slug) mergedMap.set(a.slug, a);
          });

          articles = Array.from(mergedMap.values());
        }
      } catch (error) {
        console.error("[RobinRank] Failed to fetch articles from REST API:", error);
      }
    }
  }

  // 5. Fallback seed articles if no content exists yet to ensure clean presentation
  if (articles.length === 0) {
    articles = [
      {
        id: "seed-1",
        title: "The Future of AI Voice Cloning: Precision & Ethics in 2026",
        slug: "future-of-ai-voice-cloning",
        content: `## The Evolution of Voice Ingestion & Synthesis

Voice cloning technology has advanced rapidly over recent years. Modern neural network architectures allow creators to replicate high-fidelity voice profiles with just a few seconds of clean reference audio.

### Key Capabilities of Tarang Voice Engine:
1. **Low-Latency Synthesis**: Instant generation of expressive speech across multiple accents.
2. **Spectral Cleanup**: Automatic noise reduction and artifact removal during audio separation.
3. **Cross-Lingual Expressiveness**: Seamless translation of cloned voice characteristics into over 100 languages.

> "AI voice cloning isn't just about sound reproduction — it's about preserving human emotion and nuance at scale."

### Practical Use Cases for Creators
- **Podcasting**: Generate instant audio pickups without re-recording in studio.
- **Localization**: Translate video audio into global languages in your original voice.
- **Audiobooks**: Produce full chapter narrations with dynamic vocal energy.`,
        excerpt: "Discover how AI voice cloning is transforming content creation, localization, and audio production in 2026.",
        published_at: new Date().toISOString(),
        tags: ["Voice AI", "Tutorial", "Cloning"],
        status: "published",
      },
      {
        id: "seed-2",
        title: "How to Separate Vocal Tracks from Any Song or Podcast Audio",
        slug: "how-to-separate-vocal-tracks",
        content: `## Mastering Audio Stem Separation with AI

Isolating speech or singing from background sound used to require complex equalizer tweaks and expensive DAW setups. With modern AI voice separation algorithms, stems can be isolated in seconds.

### Step-by-Step Separation Workflow:
1. **Upload Audio**: Support for MP3, WAV, M4A, and FLAC files.
2. **Select Target Track**: Choose to isolate Vocals, Instrumental, or Background Noise.
3. **Download Stems**: Export studio-grade stems with zero phase cancellation.

\`\`\`bash
# Sample API command for automated stem separation
curl -X POST https://api.trytarang.app/v1/voice/separate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@podcast_sample.wav"
\`\`\`

Whether you're producing music remixes, cleaning up interview recordings, or extracting vocal samples for speech modeling, Tarang makes stem extraction effortless.`,
        excerpt: "A guide on isolating vocals and background music using Tarang's state-of-the-art Voice Separation engine.",
        published_at: new Date(Date.now() - 86400000).toISOString(),
        tags: ["Audio Processing", "Voice Separation", "Guide"],
        status: "published",
      },
    ];
  }

  // Filter for published status and sort by publication date descending
  return articles
    .filter((a) => isPublishedStatus(a.status))
    .sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at || 0).getTime();
      const dateB = new Date(b.published_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
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
 * Generate a plain-text excerpt from HTML/Markdown content.
 */
export function generateExcerpt(content: string, maxLength = 160): string {
  if (!content) return "";
  const text = content
    .replace(/<[^>]*>/g, "")
    .replace(/#+\s*/g, "")
    .replace(/[*_~`]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength
    ? text.slice(0, maxLength).trimEnd() + "…"
    : text;
}

