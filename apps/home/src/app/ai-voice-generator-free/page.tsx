import type { Metadata } from "next";
import Background from "@/components/Background/Background";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import ExampleVideo from "@/components/ExampleVideo/ExampleVideo";
import FaqAccordion from "@/components/FaqAccordion/FaqAccordion";
import styles from "./FreeGeneratorPage.module.css";

const SITE_URL = "https://trytarang.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const CDN = "https://cdn.trytarang.app/video_examples";

/* ── SEO Metadata ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title:
    "Free AI Voice Generator — Natural Speech in 100+ Languages | Tarang",
  description:
    "Tarang is a free AI voice generator that creates natural speech and clones any voice in 100+ languages including Hindi, Tamil, Bengali, Marathi. Sign up — get 10,000 free credits instantly.",
  keywords: [
    "ai voice generator free",
    "free ai voice generator",
    "ai voice generator",
    "text to speech free",
    "voice cloning free",
    "ai voice generator hindi",
    "ai voice generator tamil",
    "free voice generator online",
    "ai voice generator free indian",
  ],
  alternates: { canonical: "/ai-voice-generator-free" },
  openGraph: {
    title: "Free AI Voice Generator — 100+ Languages | Tarang",
    description:
      "Create natural speech and clone any voice in 100+ languages. 10,000 free credits on signup.",
    url: `${SITE_URL}/ai-voice-generator-free`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Voice Generator — 100+ Languages | Tarang",
    description:
      "Create natural speech and clone any voice in 100+ languages. 10K free credits.",
  },
};

/* ── FAQ Data ─────────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    question: "Is Tarang AI voice generator really free?",
    answer:
      "Yes — sign up and get 10,000 free credits instantly. No credit card required. Credits are consumed based on text length. Paid plans are available for higher volumes.",
  },
  {
    question: "How many languages does Tarang support?",
    answer:
      "Tarang supports over 100 languages with native pronunciation, including Hindi, Tamil, Bengali, Marathi, Gujarati, Telugu, Kannada, Malayalam, and dozens more.",
  },
  {
    question: "What is AI voice cloning and how does it work?",
    answer:
      "AI voice cloning creates a digital replica of any voice from a 10-second audio sample. The cloned voice preserves tone, accent, and speaking style — and works across all 100+ supported languages.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No — Tarang is entirely web-based. Visit trytarang.app, sign up, and start generating studio-quality voice content directly in your browser.",
  },
  {
    question: "Can I use generated audio for commercial projects?",
    answer:
      "Yes — audio generated with Tarang can be used in YouTube videos, podcasts, advertisements, e-learning content, and other commercial projects.",
  },
  {
    question: "What audio quality does Tarang produce?",
    answer:
      "Tarang produces studio-quality audio at 24kHz sampling rate with natural intonation and emotional delivery — suitable for professional media production.",
  },
  {
    question: "How is Tarang different from other AI voice generators?",
    answer:
      "Tarang is built for multi-language expressiveness with deep Indian language support. Unlike generic TTS tools, Tarang offers voice cloning, emotional delivery, and native pronunciation for 100+ languages — all with a generous free tier.",
  },
  {
    question: "How fast is the voice generation?",
    answer:
      "Most text-to-speech requests complete in under 5 seconds. Voice cloning setup takes about 30 seconds for the initial profile creation, after which generation is instant.",
  },
];

/* ── Structured Data (JSON-LD) ────────────────────────────────────────────── */

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Use Tarang Free AI Voice Generator",
  description:
    "Generate natural AI speech in 100+ languages with Tarang's free voice generator.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Sign Up Free",
      text: "Create a free Tarang account and receive 10,000 credits instantly — no credit card required.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Enter Text & Choose a Voice",
      text: "Type or paste your text in any of 100+ languages. Select a preset voice or clone your own from a 10-second audio sample.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Generate & Download",
      text: "Click Generate to create studio-quality audio in seconds. Download and use in your projects.",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tarang — Free AI Voice Generator",
  url: `${SITE_URL}/ai-voice-generator-free`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Free AI voice generator with voice cloning and text-to-speech in 100+ languages.",
  featureList: [
    "Text-to-speech in 100+ languages",
    "AI voice cloning from 10-second audio samples",
    "10,000 free credits on signup",
    "Studio-quality 24kHz audio output",
    "Indian language support: Hindi, Tamil, Bengali, Marathi, Gujarati",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier with 10,000 credits — no credit card required",
  },
};

const speakableSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Free AI Voice Generator",
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["#hero-definition", "h1"],
  },
};

/* ── Features Data ────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: "🎙️",
    title: "Text-to-Speech",
    description:
      "Convert text to natural, expressive speech in 100+ languages. Studio-quality audio output at 24kHz.",
  },
  {
    icon: "🧬",
    title: "Voice Cloning",
    description:
      "Clone any voice from a 10-second audio sample. The cloned voice works across all supported languages.",
  },
  {
    icon: "🌍",
    title: "100+ Languages",
    description:
      "Native pronunciation for Hindi, Tamil, Bengali, Marathi, Gujarati, and dozens more — not transliterated English.",
  },
  {
    icon: "🎵",
    title: "Voice Separation",
    description:
      "Isolate vocals, instruments, bass, and drums from any audio file. Perfect for remixing and content creation.",
  },
];

const LANGUAGES = [
  { name: "Hindi", script: "हिन्दी", region: "Indian" },
  { name: "Tamil", script: "தமிழ்", region: "Indian" },
  { name: "Bengali", script: "বাংলা", region: "Indian" },
  { name: "Marathi", script: "मराठी", region: "Indian" },
  { name: "Gujarati", script: "ગુજરાતી", region: "Indian" },
  { name: "Telugu", script: "తెలుగు", region: "Indian" },
  { name: "Kannada", script: "ಕನ್ನಡ", region: "Indian" },
  { name: "Malayalam", script: "മലയാളം", region: "Indian" },
  { name: "English", script: "English", region: "Global" },
  { name: "Spanish", script: "Español", region: "Global" },
  { name: "French", script: "Français", region: "Global" },
  { name: "German", script: "Deutsch", region: "Global" },
  { name: "Japanese", script: "日本語", region: "Asian" },
  { name: "Korean", script: "한국어", region: "Asian" },
  { name: "Chinese", script: "中文", region: "Asian" },
  { name: "Arabic", script: "العربية", region: "Global" },
  { name: "Russian", script: "Русский", region: "Global" },
  { name: "Portuguese", script: "Português", region: "Global" },
  { name: "Italian", script: "Italiano", region: "Global" },
  { name: "Turkish", script: "Türkçe", region: "Global" },
];

/* ── Page Component ───────────────────────────────────────────────────────── */

export default function FreeGeneratorPage() {
  return (
    <>
      <Background />
      <Navbar />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            howToSchema,
            faqSchema,
            softwareSchema,
            speakableSchema,
          ]),
        }}
      />

      <main className={styles.page} id="ai-voice-generator-free">
        {/* ── Hero ── */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroBadges}>
            <span className={styles.badge}>✨ Free — 10K Credits</span>
            <span className={styles.badge}>🌍 100+ Languages</span>
            <span className={styles.badge}>🧬 Voice Cloning</span>
          </div>

          <h1 id="hero-title" className={styles.heroTitle}>
            Free AI Voice Generator
            <br />
            <em>Natural Speech in 100+ Languages</em>
          </h1>

          <p id="hero-definition" className={styles.heroDescription}>
            Tarang is a free AI voice generator that creates natural, expressive
            speech from text in over 100 languages including Hindi, Tamil,
            Bengali, Marathi, and Gujarati. Sign up and get{" "}
            <strong>10,000 free credits instantly</strong> — no credit card
            required. Tarang also features spontaneous AI voice cloning, letting
            you replicate any voice from just a 10-second audio sample.
          </p>

          <div className={styles.heroCtas}>
            <a href={APP_URL} className={styles.ctaPrimary}>
              Try Free — Get 10K Credits <span aria-hidden="true">→</span>
            </a>
            <a href="#demo" className={styles.ctaSecondary}>
              Watch Demo
            </a>
          </div>

          <div className={styles.trustRow}>
            <span>✓ No credit card</span>
            <span>✓ No install needed</span>
            <span>✓ Studio-quality audio</span>
          </div>
        </section>

        {/* ── Video Demo ── */}
        <section className={styles.section} id="demo" aria-label="Voice demo">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              See <em>voice cloning</em> in action
            </h2>
            <p className={styles.sectionSubtitle}>
              Clone any voice from a 10-second sample. Use it to speak any
              language.
            </p>
          </div>
          <div className={styles.videoWrapper}>
            <ExampleVideo
              className={styles.video}
              src={`${CDN}/voice-clone-demo.mp4`}
              poster={`${CDN}/voice-clone-demo-poster.png`}
              ariaLabel="Tarang AI voice cloning demo video"
            />
          </div>
        </section>

        {/* ── How It Works ── */}
        <section
          className={styles.section}
          id="how-it-works"
          aria-label="How it works"
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              How it <em>works</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Three steps. No installs. No credit card.
            </p>
          </div>
          <div className={styles.stepsGrid}>
            {howToSchema.step.map((step) => (
              <div key={step.position} className={styles.stepCard}>
                <span className={styles.stepNumber}>{step.position}</span>
                <h3 className={styles.stepTitle}>{step.name}</h3>
                <p className={styles.stepDescription}>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section
          className={styles.section}
          id="features"
          aria-label="Features"
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Everything you need to <em>create</em>
            </h2>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Voice Cloning Highlight ── */}
        <section
          className={styles.section}
          id="voice-cloning"
          aria-label="Voice cloning"
        >
          <div className={styles.highlightCard}>
            <div className={styles.highlightContent}>
              <span className={styles.highlightBadge}>🧬 Voice Cloning</span>
              <h2 className={styles.highlightTitle}>
                Clone any voice. <em>In seconds.</em>
              </h2>
              <p className={styles.highlightDescription}>
                Upload a 10-second audio sample and Tarang creates a digital
                replica of the voice — preserving tone, accent, speaking
                patterns, and emotional range. The cloned voice works across all
                100+ supported languages instantly.
              </p>
              <ul className={styles.highlightList}>
                <li>10-second sample is all you need</li>
                <li>Works across all 100+ languages</li>
                <li>Preserves accent &amp; emotional delivery</li>
                <li>Use for dubbing, content, education</li>
              </ul>
              <a href={APP_URL} className={styles.ctaPrimary}>
                Clone Your Voice Free <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className={styles.highlightVideo}>
              <ExampleVideo
                className={styles.video}
                src={`${CDN}/expressive-voice-demo.mp4`}
                poster={`${CDN}/expressive-voice-demo-poster.png`}
                ariaLabel="Expressive voice generation demo"
              />
            </div>
          </div>
        </section>

        {/* ── Supported Languages ── */}
        <section
          className={styles.section}
          id="languages"
          aria-label="Supported languages"
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <em>100+</em> Languages Supported
            </h2>
            <p className={styles.sectionSubtitle}>
              Native pronunciation — not transliterated English. Deep Indian
              language support included.
            </p>
          </div>
          <div className={styles.languageGrid}>
            {LANGUAGES.map((lang) => (
              <div key={lang.name} className={styles.languageChip}>
                <span className={styles.languageName}>{lang.name}</span>
                <span className={styles.languageScript}>{lang.script}</span>
              </div>
            ))}
            <div className={`${styles.languageChip} ${styles.moreChip}`}>
              <span className={styles.languageName}>+80 more</span>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className={styles.section} id="faq" aria-label="FAQ">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Frequently Asked <em>Questions</em>
            </h2>
          </div>
          <FaqAccordion items={FAQ_ITEMS} />
        </section>

        {/* ── Bottom CTA ── */}
        <section className={styles.bottomCta} aria-label="Get started">
          <h2 className={styles.bottomCtaTitle}>
            Ready to create with your voice?
          </h2>
          <p className={styles.bottomCtaText}>
            Sign up free. Get 10,000 credits. Clone your voice. Speak any
            language.
          </p>
          <a href={APP_URL} className={styles.ctaPrimary}>
            Get Started Free <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>

      <Footer />
    </>
  );
}
