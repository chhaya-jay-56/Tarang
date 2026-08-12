import { MetadataRoute } from "next";
import { fetchArticles } from "@/lib/robinrank";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://trytarang.app";

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // Fetch blog articles dynamically
  try {
    const articles = await fetchArticles();
    for (const article of articles) {
      if (article.slug) {
        routes.push({
          url: `${baseUrl}/blog/${article.slug}`,
          lastModified: article.published_at
            ? new Date(article.published_at)
            : new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
        // Also add root slug URL for RobinRank backlink verification matching
        routes.push({
          url: `${baseUrl}/${article.slug}`,
          lastModified: article.published_at
            ? new Date(article.published_at)
            : new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch (error) {
    console.error("[Sitemap] Error fetching articles for sitemap:", error);
  }

  return routes;
}
