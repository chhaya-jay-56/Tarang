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
  title: "AI Voice Generator for Marathi — Free Online | Tarang",
  description:
    "Generate natural AI speech in Marathi (मराठी) with native Devanagari pronunciation. Free online AI voice generator with voice cloning. 10,000 free credits.",
  keywords: [
    "ai voice generator marathi",
    "marathi text to speech",
    "marathi voice generator free",
    "marathi tts",
    "ai voice marathi",
  ],
  alternates: { canonical: "/tools/ai-voice-generator-marathi" },
  openGraph: {
    title: "AI Voice Generator for Marathi — Free | Tarang",
    description:
      "Generate natural AI speech in Marathi with native pronunciation. Free 10K credits.",
    url: `${SITE_URL}/tools/ai-voice-generator-marathi`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Does Tarang handle Marathi-specific Devanagari conjuncts?",
    answer:
      "Yes — Tarang's Marathi voice model is specifically trained to handle Marathi Devanagari including unique conjuncts and pronunciation patterns distinct from Hindi.",
  },
  {
    question: "What Marathi dialects are supported?",
    answer:
      "Tarang currently supports standard Marathi pronunciation. Mumbai and Pune dialect variations are handled naturally through the neural model.",
  },
  {
    question: "Can I clone a Marathi voice?",
    answer:
      "Yes — upload a 10-second Marathi audio sample and Tarang creates a digital voice clone. The cloned voice works across all 100+ supported languages.",
  },
  {
    question: "Is Marathi voice generation free?",
    answer:
      "Yes — sign up and get 10,000 free credits. Marathi uses the same credit rate as any other language — no premium charge.",
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

export default function MarathiPage() {
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
          <span className={styles.badge}>🇮🇳 Marathi — मराठी</span>

          <h1 className={styles.title}>
            AI Voice Generator for <em>Marathi</em>
            <br />
            Free Online
          </h1>

          <p className={styles.description}>
            Tarang generates natural, expressive AI speech in{" "}
            <strong>Marathi (मराठी)</strong> with native Devanagari
            pronunciation — handling Marathi-specific conjuncts and intonation
            patterns. Sign up and get <strong>10,000 free credits</strong> to
            create studio-quality Marathi audio instantly. Spontaneous voice
            cloning is also supported from just a 10-second audio sample.
          </p>

          <h2 className={styles.sectionTitle}>
            How to Generate Marathi Speech
          </h2>
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
              <h3 className={styles.stepLabel}>Type in Marathi</h3>
              <p className={styles.stepText}>
                Enter text in Devanagari. Select a Marathi voice profile.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <h3 className={styles.stepLabel}>Generate</h3>
              <p className={styles.stepText}>
                Get natural Marathi audio in seconds. Download and use.
              </p>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Marathi Voice Features</h2>
          <ul className={styles.featuresList}>
            <li>Native Marathi Devanagari pronunciation</li>
            <li>Marathi-specific conjunct handling</li>
            <li>Mumbai and Pune dialect support</li>
            <li>Voice cloning from 10-second samples</li>
            <li>Male and female voice profiles</li>
            <li>Studio-quality 24kHz audio output</li>
          </ul>

          <h2 className={styles.sectionTitle}>Language Feature Comparison</h2>
          <div className={styles.matrixSection}>
            <LanguageMatrix highlight="Marathi" />
          </div>

          <Link href="/examples" className={styles.videoLink}>
            🎬 Watch voice cloning demos <span>→</span>
          </Link>

          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <FaqAccordion items={FAQ_ITEMS} />

          <div className={styles.cta}>
            <h2 className={styles.ctaTitle}>
              Start generating Marathi speech today
            </h2>
            <p className={styles.ctaText}>
              Sign up free. Get 10,000 credits. Generate natural Marathi audio
              in seconds.
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
