import type { Metadata } from "next";
import { fetchArticles } from "@/lib/robinrank";
import BlogCard from "@/components/BlogCard/BlogCard";
import Navbar from "@/components/Navbar/Navbar";
import Background from "@/components/Background/Background";
import Footer from "@/components/Footer/Footer";
import styles from "./blog.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Blog | Tarang — Voice AI Insights & Tutorials",
  description:
    "Explore the latest articles on AI voice cloning, text-to-speech, voice separation, and creative voice AI workflows. Stay updated with Tarang.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | Tarang — Voice AI Insights & Tutorials",
    description:
      "Learn about AI voice technology, tutorials, and industry trends from Tarang.",
    type: "website",
  },
};

export default async function BlogPage() {
  const articles = await fetchArticles();

  return (
    <>
      <Background />
      <Navbar />

      <main className={styles.blogPage} id="blog-listing">
        <div className={styles.container}>
          {/* Header */}
          <header className={styles.header}>
            <span className={styles.badge}>📝 Blog</span>
            <h1 className={styles.heading}>Voice AI Insights</h1>
            <p className={styles.subheading}>
              Articles on AI voice cloning, text-to-speech, voice separation,
              and the future of creative voice technology.
            </p>
          </header>

          {/* Articles Grid */}
          {articles.length > 0 ? (
            <div className={styles.grid}>
              {articles.map((article) => (
                <BlogCard key={article.id || article.slug} article={article} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🎙️</span>
              <h2 className={styles.emptyTitle}>Coming Soon</h2>
              <p className={styles.emptyText}>
                We&apos;re working on fresh articles about voice AI, cloning
                techniques, and creative workflows. Check back soon!
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
