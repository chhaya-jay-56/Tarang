import { redirect, notFound } from "next/navigation";
import { fetchArticleBySlug } from "@/lib/robinrank";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CatchAllSlugPage({ params }: PageProps) {
  const { slug } = await params;
  
  // Check if this slug corresponds to a published blog article
  const article = await fetchArticleBySlug(slug);

  if (article) {
    // Redirect to the canonical /blog/[slug] path
    redirect(`/blog/${slug}`);
  }

  // Otherwise 404
  notFound();
}
