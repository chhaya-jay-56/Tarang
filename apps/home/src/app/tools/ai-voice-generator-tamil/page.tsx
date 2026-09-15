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
  title: "AI Voice Generator for Tamil — Free Online | Tarang",
  description:
    "Generate natural AI speech in Tamil (தமிழ்) with native pronunciation. Free online AI voice generator with voice cloning. 10,000 free credits on signup.",
  keywords: [
    "ai voice generator tamil",
    "tamil text to speech",
    "tamil voice generator free",
    "tamil tts",
    "ai voice tamil",
  ],
  alternates: { canonical: "/tools/ai-voice-generator-tamil" },
  openGraph: {
    title: "AI Voice Generator for Tamil — Free | Tarang",
    description:
      "Generate natural AI speech in Tamil with native pronunciation. Free 10K credits.",
    url: `${SITE_URL}/tools/ai-voice-generator-tamil`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Can I type in Tamil script directly?",
    answer:
      "Yes — Tarang accepts Tamil script (தமிழ்) natively. Type directly in Tamil and generate natural speech with proper retroflex consonants and intonation.",
  },
  {
    question: "Does Tarang handle Tanglish (Tamil-English mix)?",
    answer:
      "Yes — Tarang handles code-switching between Tamil and English. You can mix both languages naturally in your text input.",
  },
  {
    question: "What Tamil voice profiles are available?",
    answer:
      "Tarang offers male and female Tamil voice profiles with support for both formal (classical Tamil) and colloquial (everyday) speech styles.",
  },
  {
    question: "Is Tamil voice generation free?",
    answer:
      "Yes — sign up and get 10,000 free credits. Tamil uses the same credit rate as English — no premium charge.",
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

export default function TamilPage() {
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
          <span className={styles.badge}>🇮🇳 Tamil — தமிழ்</span>

          <h1 className={styles.title}>
            AI Voice Generator for <em>Tamil</em>
            <br />
            Free Online
          </h1>

          <p className={styles.description}>
            Tarang generates natural, expressive AI speech in{" "}
            <strong>Tamil (தமிழ்)</strong> with native pronunciation including
            proper retroflex consonants — not accented English approximations.
            Sign up and get <strong>10,000 free credits</strong> to create
            studio-quality Tamil audio instantly. Tarang also supports
            spontaneous voice cloning from just a 10-second sample.
          </p>

          <h2 className={styles.sectionTitle}>How to Generate Tamil Speech</h2>
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
              <h3 className={styles.stepLabel}>Type in Tamil</h3>
              <p className={styles.stepText}>
                Enter text in Tamil script. Select a Tamil voice profile.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <h3 className={styles.stepLabel}>Generate</h3>
              <p className={styles.stepText}>
                Get natural Tamil audio in seconds. Download and use.
              </p>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Tamil Voice Features</h2>
          <ul className={styles.featuresList}>
            <li>Native Tamil script pronunciation</li>
            <li>Proper retroflex consonants (ட, ண, ற)</li>
            <li>Tanglish code-switching support</li>
            <li>Classical and colloquial speech styles</li>
            <li>Voice cloning from 10-second samples</li>
            <li>Studio-quality 24kHz audio output</li>
          </ul>

          <h2 className={styles.sectionTitle}>Language Feature Comparison</h2>
          <div className={styles.matrixSection}>
            <LanguageMatrix highlight="Tamil" />
          </div>

          <Link href="/examples" className={styles.videoLink}>
            🎬 Watch voice cloning demos <span>→</span>
          </Link>

          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <FaqAccordion items={FAQ_ITEMS} />

          <div className={styles.cta}>
            <h2 className={styles.ctaTitle}>
              Start generating Tamil speech today
            </h2>
            <p className={styles.ctaText}>
              Sign up free. Get 10,000 credits. Generate natural Tamil audio in
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
