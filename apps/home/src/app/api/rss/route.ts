import { NextResponse } from "next/server";
import { fetchArticles, generateExcerpt } from "@/lib/robinrank";

const SITE_URL = "https://trytarang.app";

/**
 * RSS Feed endpoint at /api/rss
 *
 * This feed can be used to auto-syndicate articles to:
 * - Dev.to (Settings → Extensions → RSS Feed)
 * - Hashnode (Dashboard → Import → RSS)
 * - Any RSS reader
 */
export async function GET() {
  const articles = await fetchArticles();

  const rssItems = articles
    .map((article) => {
      const link = `${SITE_URL}/blog/${article.slug}`;
      const pubDate = article.published_at || article.created_at;
      const description =
        article.excerpt || generateExcerpt(article.content || "", 300);

      return `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${pubDate ? `<pubDate>${new Date(pubDate).toUTCString()}</pubDate>` : ""}
      <description><![CDATA[${description}]]></description>
      ${article.content ? `<content:encoded><![CDATA[${article.content}]]></content:encoded>` : ""}
      ${article.tags?.map((tag) => `<category>${tag}</category>`).join("\n      ") || ""}
    </item>`;
    })
    .join("\n");

  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tarang Blog — Voice AI Insights</title>
    <link>${SITE_URL}/blog</link>
    <description>Articles on AI voice cloning, text-to-speech, voice separation, and the future of creative voice technology by Tarang.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/api/rss" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssFeed, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
