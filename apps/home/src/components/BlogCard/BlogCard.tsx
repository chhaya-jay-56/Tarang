import Link from "next/link";
import { generateExcerpt, type RobinRankArticle } from "@/lib/robinrank";
import styles from "./BlogCard.module.css";

interface BlogCardProps {
  article: RobinRankArticle;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const BlogCard = ({ article }: BlogCardProps) => {
  const excerpt =
    article.excerpt || generateExcerpt(article.content || "", 140);
  const date = formatDate(article.published_at || article.created_at);

  return (
    <Link
      href={`/blog/${article.slug}`}
      className={styles.card}
      id={`blog-card-${article.slug}`}
    >
      {/* Thumbnail */}
      <div className={styles.thumbnail}>
        {article.featured_image ? (
          <img
            src={article.featured_image}
            alt={article.title}
            className={styles.thumbnailImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbnailPlaceholder}>
            <span className={styles.placeholderIcon}>🎙️</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.meta}>
          {date && <span className={styles.date}>{date}</span>}
          {article.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>

        <h3 className={styles.title}>{article.title}</h3>

        {excerpt && <p className={styles.excerpt}>{excerpt}</p>}

        <span className={styles.readMore}>
          Read article
          <span className={styles.arrow}>→</span>
        </span>
      </div>
    </Link>
  );
};

export default BlogCard;
