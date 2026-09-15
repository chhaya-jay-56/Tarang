import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background/Background";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import FaqAccordion from "@/components/FaqAccordion/FaqAccordion";
import LanguageMatrix from "@/components/LanguageMatrix/LanguageMatrix";
import styles from "../LanguagePage.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const SITE_URL = "https://trytarang.app";

export const metadata: Metadata = {
  title: "AI Voice Generator for Hindi — Free Online | Tarang",
  description:
    "Generate natural AI speech in Hindi (हिन्दी) with Tarang's free online voice generator. Native Devanagari pronunciation, voice cloning, and text-to-speech. 10,000 free credits.",
  keywords: [
    "ai voice generator hindi",
    "ai voice generator hindi free",
    "ai voice generator in hindi",
    "hindi text to speech",
    "hindi voice cloning",
    "hindi tts free",
  ],
  alternates: { canonical: "/tools/ai-voice-generator-hindi" },
  openGraph: {
    title: "AI Voice Generator for Hindi — Free | Tarang",
    description:
      "Generate natural AI speech in Hindi with native Devanagari pronunciation. Free 10K credits.",
    url: `${SITE_URL}/tools/ai-voice-generator-hindi`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Can I type in Devanagari script directly?",
    answer:
      "Yes — Tarang accepts Hindi input in Devanagari script natively. No transliteration or Romanized Hindi needed. Simply type in हिन्दी and generate speech.",
  },
  {
    question: "Does Tarang support Hinglish (Hindi-English mix)?",
    answer:
      "Yes — Tarang handles code-switching between Hindi and English naturally. You can mix both languages in a single text input and the AI will pronounce each correctly.",
  },
  {
    question: "Can I clone my Hindi voice and use it in other languages?",
    answer:
      "Absolutely. Clone your voice from a 10-second Hindi audio sample, and use the cloned voice to speak Tamil, Bengali, English, or any of 100+ supported languages.",
  },
  {
    question: "Is Hindi voice generation really free?",
    answer:
      "Yes — sign up and get 10,000 free credits. Hindi generation uses the same credit rate as English — no premium charge for Indian languages.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function HindiPage() {
  return (
    <>
      <Background />
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className={styles.page}>
        <div className={styles.content}>
          <span className={styles.badge}>🇮🇳 Hindi — हिन्दी</span>

          <h1 className={styles.title}>
            AI Voice Generator for <em>Hindi</em>
            <br />
            Free Online
          </h1>

          <p className={styles.description}>
            Tarang generates natural, expressive AI speech in{" "}
            <strong>Hindi (हिन्दी)</strong> with native Devanagari pronunciation
            — not transliterated English. Sign up and get{" "}
            <strong>10,000 free credits</strong> to create studio-quality Hindi
            audio, clone voices, and generate speech instantly. Tarang also
            supports spontaneous voice cloning, so you can replicate any Hindi
            voice from a 10-second audio sample.
          </p>

          {/* How to use */}
          <h2 className={styles.sectionTitle}>How to Generate Hindi Speech</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <h3 className={styles.stepLabel}>Sign up free</h3>
              <p className={styles.stepText}>
                Create a Tarang account and get 10K credits instantly.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <h3 className={styles.stepLabel}>Type in Hindi</h3>
              <p className={styles.stepText}>
                Enter text in Devanagari script. Select a Hindi voice.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <h3 className={styles.stepLabel}>Generate</h3>
              <p className={styles.stepText}>
                Get natural Hindi audio in seconds. Download and use.
              </p>
            </div>
          </div>

          {/* Features */}
          <h2 className={styles.sectionTitle}>Hindi Voice Features</h2>
          <ul className={styles.featuresList}>
            <li>Native Devanagari pronunciation</li>
            <li>Hinglish code-switching support</li>
            <li>Voice cloning from 10-second samples</li>
            <li>Male and female voice profiles</li>
            <li>Emotional delivery (formal, conversational)</li>
            <li>Studio-quality 24kHz audio output</li>
          </ul>

          {/* Language matrix */}
          <h2 className={styles.sectionTitle}>
            Language Feature Comparison
          </h2>
          <div className={styles.matrixSection}>
            <LanguageMatrix highlight="Hindi" />
          </div>

          {/* Video link */}
          <Link href="/examples" className={styles.videoLink}>
            🎬 Watch voice cloning demos <span>→</span>
          </Link>

          {/* FAQ */}
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <FaqAccordion items={FAQ_ITEMS} />

          {/* CTA */}
          <div className={styles.cta}>
            <h2 className={styles.ctaTitle}>
              Start generating Hindi speech today
            </h2>
            <p className={styles.ctaText}>
              Sign up free. Get 10,000 credits. Generate natural Hindi audio in
              seconds.
            </p>
            <a href={APP_URL} className={styles.ctaButton}>
              Try Free — Get 10K Credits <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
