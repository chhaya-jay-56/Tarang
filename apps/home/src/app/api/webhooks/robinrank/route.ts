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

    // Store in Redis / Filesystem / Memory cache and normalize
    const article = await storeArticleInRedis(rawArticle);

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

