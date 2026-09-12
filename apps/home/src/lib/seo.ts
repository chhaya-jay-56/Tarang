import { RobinRankArticle, generateExcerpt } from "./robinrank";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Parses markdown body for FAQ sections (## FAQ or ## Frequently Asked Questions)
 * and extracts question/answer pairs for Google-compliant FAQPage JSON-LD.
 */
export function extractFaqsFromMarkdown(content: string): FaqItem[] {
  if (!content) return [];
  const faqs: FaqItem[] = [];

  // Match ## Frequently Asked Questions or ## FAQ section until the next ## heading or end of string
  const faqSectionRegex =
    /##\s*(?:Frequently Asked Questions|FAQ|Common Questions)[\s\S]*?(?=(?:\n##\s+[^\n]+)|$)/i;
  const match = content.match(faqSectionRegex);
  if (!match) return [];

  const section = match[0];
  // Match ### Question followed by answer body
  const qnaRegex = /###\s*([^\n]+)\n+([\s\S]*?)(?=(?:\n###\s+[^\n]+)|$)/g;
  let qMatch: RegExpExecArray | null;

  while ((qMatch = qnaRegex.exec(section)) !== null) {
    const q = qMatch[1].trim().replace(/^[\d.)\s]+/, "");
    // Strip markdown formatting from answer for clean JSON-LD text
    const a = qMatch[2]
      .trim()
      .replace(/[*_#`[\]()]/g, "")
      .replace(/\s+/g, " ");
    if (q && a) {
      faqs.push({ q, a });
    }
  }

  return faqs;
}

/**
 * Builds structured data array for a blog article, adding TechArticle/Article
 * and dynamic FAQPage schemas if FAQ sections are present.
 */
export function buildBlogJsonLd(
  article: RobinRankArticle,
  slug: string,
  siteUrl: string = "https://trytarang.app"
) {
  const date = article.published_at || article.created_at;
  const isTechArticle =
    article.tags?.some((t) =>
      /guide|tech|engineering|api|prosody|python|code|architecture|model/i.test(t)
    ) ||
    /how|guide|architecture|engineering|prosody|drift|chunking|latency/i.test(
      article.title
    );

  const schemas: any[] = [
    {
      "@context": "https://schema.org",
      "@type": isTechArticle ? "TechArticle" : "Article",
      headline: article.title,
      description:
        article.meta_description ||
        article.excerpt ||
        generateExcerpt(article.content || ""),
      ...(article.featured_image && { image: article.featured_image }),
      ...(date && { datePublished: date }),
      ...(article.updated_at && { dateModified: article.updated_at }),
      author: {
        "@type": "Organization",
        name: article.author || "Tarang Speech AI Research Team",
        url: siteUrl,
      },
      publisher: {
        "@type": "Organization",
        name: "Tarang",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/Logo.svg`,
        },
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${siteUrl}/blog/${slug}`,
      },
    },
  ];

  const faqs = extractFaqsFromMarkdown(article.content || "");
  if (faqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    });
  }

  return schemas;
}
