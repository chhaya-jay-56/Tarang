"use client";

import { useReveal } from "@/lib/useReveal";
import styles from "./SupportedLanguages.module.css";

/**
 * Popular languages shown as prominent chips.
 * These also appear in the ItemList JSON-LD in layout.tsx.
 */
const POPULAR = [
  "English", "Hindi", "Gujarati", "Tamil", "Telugu", "Bengali",
  "Marathi", "Kannada", "Malayalam", "Urdu", "Panjabi", "Odia",
  "Chinese", "Japanese", "Spanish", "French", "German", "Russian",
  "Portuguese", "Korean", "Italian", "Thai", "Vietnamese", "Arabic",
  "Indonesian", "Dutch", "Turkish", "Polish", "Swedish", "Danish",
];

/**
 * Extended list of all named languages — rendered as visible text
 * inside a <details> element so crawlers can index them while
 * keeping the UI compact for users.
 */
const ALL_LANGUAGES = [
  "Abkhazian", "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian",
  "Assamese", "Asturian", "Azerbaijani", "Bashkir", "Basque", "Belarusian",
  "Bengali", "Bhojpuri", "Bodo", "Bosnian", "Breton", "Bulgarian", "Burmese",
  "Cantonese", "Catalan", "Cebuano", "Chichewa", "Chinese", "Chuvash",
  "Cornish", "Croatian", "Czech", "Danish", "Dhivehi", "Dogri", "Dutch",
  "Egyptian Arabic", "English", "Esperanto", "Estonian", "Filipino", "Finnish",
  "French", "Galician", "Georgian", "German", "Greek", "Guarani", "Gujarati",
  "Gulf Arabic", "Hausa", "Hawaiian", "Hebrew", "Hindi", "Hungarian",
  "Icelandic", "Igbo", "Indonesian", "Irish", "Italian", "Japanese", "Javanese",
  "Kannada", "Kashmiri", "Kazakh", "Khmer", "Kinyarwanda", "Kirghiz",
  "Konkani", "Korean", "Lao", "Latvian", "Lingala", "Lithuanian",
  "Luxembourgish", "Macedonian", "Maithili", "Malay", "Malayalam", "Maltese",
  "Manipuri", "Maori", "Marathi", "Min Nan Chinese", "Mongolian",
  "Moroccan Arabic", "Nepali", "Northern Kurdish", "Norwegian", "Occitan",
  "Odia", "Oromo", "Panjabi", "Persian", "Polish", "Portuguese", "Pushto",
  "Romanian", "Romansh", "Russian", "Sanskrit", "Santali", "Serbian",
  "Sindhi", "Sinhala", "Slovak", "Slovenian", "Somali", "Spanish", "Swahili",
  "Swedish", "Tajik", "Tamil", "Tatar", "Telugu", "Thai", "Tibetan", "Turkish",
  "Turkmen", "Uighur", "Ukrainian", "Urdu", "Uzbek", "Vietnamese", "Welsh",
  "Western Frisian", "Wolof", "Xhosa", "Yoruba", "Zulu",
];

const INDIAN_LANGUAGES = [
  "Hindi", "Gujarati", "Marathi", "Tamil", "Telugu", "Bengali",
  "Kannada", "Malayalam", "Odia", "Panjabi", "Urdu", "Assamese",
  "Konkani", "Dogri", "Manipuri", "Santali", "Kashmiri", "Sindhi",
  "Bodo", "Maithili", "Bhojpuri", "Nepali",
];

const FAQ_ITEMS = [
  {
    q: "Does Tarang support Hindi voice cloning?",
    a: "Yes. Tarang fully supports Hindi voice cloning and text-to-speech. You can clone your voice in Hindi or convert any text to natural Hindi speech using AI. Hindi is one of Tarang's flagship languages with high-quality output.",
  },
  {
    q: "What languages does Tarang support for text to speech?",
    a: "Tarang supports text-to-speech and voice cloning in over 500 languages, including English, Hindi, Gujarati, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Spanish, French, German, Japanese, Chinese, Korean, Arabic, and many more.",
  },
  {
    q: "Can I clone my voice and speak in a different language?",
    a: "Yes. Tarang supports cross-lingual voice cloning. You can record your voice in one language and generate speech in any of 500+ supported languages while preserving your voice's unique characteristics, tone, and emotional quality.",
  },
  {
    q: "Does Tarang support regional Indian languages like Gujarati or Marathi?",
    a: `Yes. Tarang supports a wide range of regional Indian languages including ${INDIAN_LANGUAGES.slice(0, 10).join(", ")}, and more. This is a key differentiator — most global voice cloning tools do not offer this level of Indian language coverage.`,
  },
];

const SupportedLanguages = () => {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      id="languages"
      className={styles.section}
      ref={sectionRef}
    >
      <div className={styles.container}>
        <div className="reveal">
          <span className={styles.badge}>LANGUAGES</span>
          <h2 className={styles.heading}>
            AI Voice Cloning in{" "}
            <span className={styles.headingAccent}>500+ Languages</span>
          </h2>
          <p className={styles.subtitle}>
            Clone your voice or generate speech in any language — from Hindi and
            Gujarati to Japanese and Spanish. Regional Indian languages included.
          </p>
        </div>

        {/* Regional India callout */}
        <div className={`${styles.callout} reveal reveal-delay-1`}>
          <span className={styles.calloutIcon}>🇮🇳</span>
          Regional Indian languages: {INDIAN_LANGUAGES.slice(0, 8).join(", ")}, and more
        </div>

        {/* Popular languages grid — always visible, crawlable */}
        <div className={`${styles.popularGrid} reveal reveal-delay-2`}>
          {POPULAR.map((lang) => (
            <span key={lang} className={styles.langChip}>
              {lang}
            </span>
          ))}
        </div>

        {/* Expandable full language list — crawlable HTML even when collapsed */}
        <details className={`${styles.expandable} reveal reveal-delay-3`}>
          <summary>
            View all {ALL_LANGUAGES.length}+ named languages
            <span className={styles.expandableArrow}>▼</span>
          </summary>
          <div className={styles.allLangsGrid}>
            {ALL_LANGUAGES.map((lang) => (
              <span key={lang} className={styles.allLangTag}>
                {lang}
              </span>
            ))}
          </div>
        </details>

        {/* FAQ — visible on page + matches FAQPage schema in layout.tsx */}
        <div className={`${styles.faqSection} reveal reveal-delay-3`}>
          <h3 className={styles.faqTitle}>Frequently Asked Questions</h3>
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary>
                {item.q}
                <span className={styles.faqArrow}>▼</span>
              </summary>
              <p className={styles.faqAnswer}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SupportedLanguages;
