import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { storeArticleInRedis, RobinRankArticle, generateExcerpt } from "@/lib/robinrank";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    console.log("[RobinRank Webhook] Received payload:", JSON.stringify(body, null, 2));

    // Handle RobinRank "Test connection" ping or empty test payloads
    if (
      !body ||
      Object.keys(body).length === 0 ||
      body.event === "ping" ||
      body.test ||
      body.type === "ping" ||
      body.action === "ping" ||
      body.event === "test"
    ) {
      return NextResponse.json({
        success: true,
        message: "Webhook connection test successful",
      });
    }

    // Handle payload standard formats:
    // 1. { event: "article.published", data: { ...article } }
    // 2. { article: { ... } } / { post: { ... } } / { payload: { ... } }
    // 3. Direct { title: "...", slug: "...", content: "..." }
    const rawArticle = body.data ?? body.article ?? body.post ?? body.payload ?? body.item ?? body;

    // If it's a test ping payload that has generic non-article fields, accept it with 200 OK
    if (!rawArticle.title && !rawArticle.slug && !rawArticle.id && !rawArticle.content) {
      return NextResponse.json({
        success: true,
        message: "Webhook ping received",
      });
    }

    const title = rawArticle.title || rawArticle.heading || rawArticle.name || "Untitled Article";
    const rawContent =
      rawArticle.content ||
      rawArticle.markdown ||
      rawArticle.html ||
      rawArticle.body ||
      rawArticle.text ||
      rawArticle.message ||
      "";

    const generatedSlug =
      rawArticle.slug ||
      rawArticle.url_slug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      "article-" + Date.now();

    const rawExcerpt = rawArticle.excerpt || rawArticle.description || rawArticle.summary || "";
    const excerpt = rawExcerpt || generateExcerpt(rawContent, 160);

    // Tags normalization
    let tags: string[] = [];
    if (Array.isArray(rawArticle.tags)) {
      tags = rawArticle.tags.map((t: any) => String(typeof t === "object" ? t.name || t.label : t));
    } else if (typeof rawArticle.tags === "string") {
      tags = rawArticle.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
    }

    const article: RobinRankArticle = {
      id: String(rawArticle.id || generatedSlug),
      title,
      slug: generatedSlug,
      content: rawContent,
      excerpt,
      published_at:
        rawArticle.published_at ||
        rawArticle.created_at ||
        rawArticle.date ||
        new Date().toISOString(),
      meta_title: rawArticle.meta_title || title,
      meta_description: rawArticle.meta_description || excerpt,
      featured_image:
        rawArticle.featured_image ||
        rawArticle.image_url ||
        rawArticle.image ||
        rawArticle.thumbnail,
      status: rawArticle.status || rawArticle.state || "published",
      tags: tags.length > 0 ? tags : ["Voice AI", "Blog"],
      author: rawArticle.author || rawArticle.author_name || "Tarang Team",
    };

    // Store in Redis / Filesystem / Memory cache
    await storeArticleInRedis(article);

    // Trigger instant Next.js App Router cache revalidation for all blog routes
    try {
      revalidatePath("/blog");
      revalidatePath(`/blog/${article.slug}`);
      revalidatePath("/[slug]", "page");
      revalidatePath("/");
      revalidatePath("/sitemap.xml");
      revalidatePath("/api/rss");
    } catch (revalError) {
      console.warn("[RobinRank Webhook] Cache revalidation warning:", revalError);
    }

    return NextResponse.json({
      success: true,
      message: "Article processed and published successfully",
      slug: article.slug,
      title: article.title,
    });
  } catch (error: any) {
    console.error("[RobinRank Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "RobinRank webhook endpoint is active and ready for autonomous article ingestion.",
    endpoint: "/api/webhooks/robinrank",
  });
}

