import { NextRequest, NextResponse } from "next/server";
import { storeArticleInRedis, RobinRankArticle } from "@/lib/robinrank";

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
    // 2. { article: { ... } }
    // 3. { title: "...", slug: "...", content: "..." }
    const rawArticle = body.data ?? body.article ?? body;

    // If it's a test ping payload that has generic non-article fields, accept it with 200 OK
    if (!rawArticle.title && !rawArticle.slug && !rawArticle.id) {
      return NextResponse.json({
        success: true,
        message: "Webhook ping received",
      });
    }

    const article: RobinRankArticle = {
      id: String(rawArticle.id || rawArticle.slug || Date.now()),
      title: rawArticle.title || "Untitled Article",
      slug: rawArticle.slug || rawArticle.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "article-" + Date.now(),
      content: rawArticle.content || rawArticle.html || rawArticle.body || "",
      excerpt: rawArticle.excerpt || rawArticle.description || "",
      published_at: rawArticle.published_at || rawArticle.created_at || new Date().toISOString(),
      meta_title: rawArticle.meta_title || rawArticle.title,
      meta_description: rawArticle.meta_description || rawArticle.excerpt,
      featured_image: rawArticle.featured_image || rawArticle.image_url || rawArticle.image,
      status: rawArticle.status || "published",
      tags: rawArticle.tags || [],
    };

    // Store in Upstash Redis / Memory cache
    await storeArticleInRedis(article);

    return NextResponse.json({
      success: true,
      message: "Article processed successfully",
      slug: article.slug,
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
    message: "RobinRank webhook endpoint is active.",
  });
}
