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
    {
      url: `${baseUrl}/examples`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // SEO keyword landing pages
    {
      url: `${baseUrl}/ai-voice-generator-free`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/ai-voice-generator-hindi`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/tools/ai-voice-generator-tamil`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/tools/ai-voice-generator-marathi`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/tools/ai-voice-generator-bengali`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
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
      }
    }
  } catch (error) {
    console.error("[Sitemap] Error fetching articles for sitemap:", error);
  }

  return routes;
}
