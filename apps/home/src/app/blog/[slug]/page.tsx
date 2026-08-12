import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchArticleBySlug,
  fetchArticles,
  generateExcerpt,
} from "@/lib/robinrank";
import { renderMarkdownToHtml } from "@/lib/markdown";
import Navbar from "@/components/Navbar/Navbar";
import Background from "@/components/Background/Background";
import Footer from "@/components/Footer/Footer";
import styles from "./article.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const SITE_URL = "https://trytarang.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/* ── Static params for ISR ────────────────────────────────────────────────── */
export async function generateStaticParams() {
  const articles = await fetchArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

/* ── Dynamic metadata ─────────────────────────────────────────────────────── */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) {
    return { title: "Article Not Found | Tarang" };
  }

  const description =
    article.meta_description ||
    article.excerpt ||
    generateExcerpt(article.content || "");

  return {
    title: `${article.meta_title || article.title} | Tarang Blog`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: article.meta_title || article.title,
      description,
      type: "article",
      url: `${SITE_URL}/blog/${slug}`,
      ...(article.featured_image && {
        images: [{ url: article.featured_image }],
      }),
    },
  };
}

/* ── Page Component ───────────────────────────────────────────────────────── */
export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const date = article.published_at || article.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const htmlContent = renderMarkdownToHtml(article.content || "");

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description:
      article.meta_description ||
      article.excerpt ||
      generateExcerpt(article.content || ""),
    ...(article.featured_image && { image: article.featured_image }),
    ...(date && { datePublished: date }),
    ...(article.updated_at && { dateModified: article.updated_at }),
    publisher: {
      "@type": "Organization",
      name: "Tarang",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
  };

  return (
    <>
      <Background />
      <Navbar />

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <main className={styles.articlePage} id="blog-article">
        <div className={styles.container}>
          {/* Back Link */}
          <Link href="/blog" className={styles.backLink}>
            <span className={styles.backArrow}>←</span>
            Back to Blog
          </Link>

          {/* Article Header */}
          <header className={styles.articleHeader}>
            <div className={styles.meta}>
              {formattedDate && (
                <span className={styles.date}>{formattedDate}</span>
              )}
              {article.tags?.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
            <h1 className={styles.articleTitle}>{article.title}</h1>
            {article.excerpt && (
              <p className={styles.articleExcerpt}>{article.excerpt}</p>
            )}
          </header>

          {/* Featured Image */}
          {article.featured_image && (
            <div className={styles.featuredImage}>
              <img src={article.featured_image} alt={article.title} />
            </div>
          )}

          {/* Article Body with rich Markdown parsing */}
          <article
            className={styles.articleContent}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          {/* CTA */}
          <div className={styles.ctaSection}>
            <h2 className={styles.ctaTitle}>Try Tarang Free</h2>
            <p className={styles.ctaText}>
              Clone your voice, generate speech in 100+ languages, and separate
              vocals — all powered by AI.
            </p>
            <a href={APP_URL} className={styles.ctaButton}>
              Get Started →
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
