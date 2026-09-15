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
  title: "AI Voice Generator for Bengali — Free Online | Tarang",
  description:
    "Generate natural AI speech in Bengali (বাংলা) with native pronunciation. Free online AI voice generator with voice cloning. 10,000 free credits on signup.",
  keywords: [
    "ai voice generator bengali",
    "bengali text to speech",
    "bengali voice generator free",
    "bengali tts",
    "ai voice bengali",
    "bangla voice generator",
  ],
  alternates: { canonical: "/tools/ai-voice-generator-bengali" },
  openGraph: {
    title: "AI Voice Generator for Bengali — Free | Tarang",
    description:
      "Generate natural AI speech in Bengali with native pronunciation. Free 10K credits.",
    url: `${SITE_URL}/tools/ai-voice-generator-bengali`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Can I type in Bengali script directly?",
    answer:
      "Yes — Tarang accepts Bengali script (বাংলা) natively. Type directly in Bengali and generate natural speech with proper nasal vowels and aspirated consonants.",
  },
  {
    question: "Does Tarang support Kolkata Bengali pronunciation?",
    answer:
      "Yes — Tarang's Bengali model is trained on Kolkata dialect patterns and handles standard Bengali pronunciation with proper sentence rhythm and prosody.",
  },
  {
    question: "Can I clone a Bengali voice?",
    answer:
      "Yes — upload a 10-second Bengali audio sample and Tarang creates a digital voice clone. Use the cloned voice in Bengali or any of 100+ other languages.",
  },
  {
    question: "Is Bengali voice generation free?",
    answer:
      "Yes — sign up and get 10,000 free credits. Bengali uses the same credit rate as any other language — no premium charge.",
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

export default function BengaliPage() {
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
          <span className={styles.badge}>🇮🇳 Bengali — বাংলা</span>

          <h1 className={styles.title}>
            AI Voice Generator for <em>Bengali</em>
            <br />
            Free Online
          </h1>

          <p className={styles.description}>
            Tarang generates natural, expressive AI speech in{" "}
            <strong>Bengali (বাংলা)</strong> with native pronunciation —
            including proper nasal vowels and aspirated consonants. Sign up and
            get <strong>10,000 free credits</strong> to create studio-quality
            Bengali audio instantly. Spontaneous voice cloning is also supported
            from just a 10-second audio sample.
          </p>

          <h2 className={styles.sectionTitle}>
            How to Generate Bengali Speech
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
              <h3 className={styles.stepLabel}>Type in Bengali</h3>
              <p className={styles.stepText}>
                Enter text in Bengali script. Select a Bengali voice.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <h3 className={styles.stepLabel}>Generate</h3>
              <p className={styles.stepText}>
                Get natural Bengali audio in seconds. Download and use.
              </p>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Bengali Voice Features</h2>
          <ul className={styles.featuresList}>
            <li>Native Bengali script pronunciation</li>
            <li>Proper nasal vowels and aspirated consonants</li>
            <li>Kolkata dialect support</li>
            <li>Voice cloning from 10-second samples</li>
            <li>Male and female voice profiles</li>
            <li>Studio-quality 24kHz audio output</li>
          </ul>

          <h2 className={styles.sectionTitle}>Language Feature Comparison</h2>
          <div className={styles.matrixSection}>
            <LanguageMatrix highlight="Bengali" />
          </div>

          <Link href="/examples" className={styles.videoLink}>
            🎬 Watch voice cloning demos <span>→</span>
          </Link>

          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <FaqAccordion items={FAQ_ITEMS} />

          <div className={styles.cta}>
            <h2 className={styles.ctaTitle}>
              Start generating Bengali speech today
            </h2>
            <p className={styles.ctaText}>
              Sign up free. Get 10,000 credits. Generate natural Bengali audio
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
