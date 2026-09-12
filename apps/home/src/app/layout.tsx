import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/jetbrains-mono";
import "../index.css";

const SITE_URL = "https://trytarang.app";

export const metadata: Metadata = {
  title: "Tarang | AI Voice Creation, Voice Cloning & TTS in 100+ Languages",
  description:
    "Tarang supports AI voice creation, voice cloning, and text-to-speech (TTS) in 100+ languages. Clone your voice and speak any language instantly.",
  keywords: ["voice cloning", "TTS", "voice creation", "100+ languages", "AI voice", "text to speech"],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },

  openGraph: {
    title: "Tarang | AI Voice Creation, Voice Cloning & TTS",
    description:
      "AI voice cloning, voice creation, and text-to-speech (TTS) in 100+ languages. Regional Indian languages included.",
    url: SITE_URL,
    siteName: "Tarang",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarang | AI Voice Creation, Voice Cloning & TTS",
    description:
      "Clone your voice in Hindi, Gujarati, Tamil, English, and 100+ more languages with advanced TTS.",
  },
};

/* ── JSON-LD structured data ─────────────────────────────────────────────── */

const POPULAR_LANG_NAMES = [
  "English", "Chinese", "Japanese", "Spanish", "French", "German",
  "Russian", "Portuguese", "Korean", "Italian", "Thai", "Vietnamese",
  "Hindi", "Indonesian", "Dutch", "Turkish", "Arabic", "Polish",
  "Swedish", "Danish", "Norwegian", "Finnish", "Bengali", "Tamil",
  "Telugu", "Urdu", "Gujarati", "Marathi", "Kannada", "Malayalam",
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tarang",
  url: SITE_URL,
  logo: `${SITE_URL}/Logo.svg`,
  description: "AI Voice Platform for multi-language voice cloning and text-to-speech.",
  sameAs: [
    "https://trytarang.app"
  ]
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tarang",
  url: SITE_URL,
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tarang",
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "AI-powered voice platform for creators — voice cloning, text-to-speech, and voice separation in 100+ languages.",
  featureList: [
    "Multi-language voice cloning (100+ languages)",
    "Text-to-speech synthesis",
    "Voice separation (vocals & instruments)",
    "Voice library with preset and custom voices",
    "Regional Indian language support (Hindi, Gujarati, Tamil, Telugu, Marathi, Bengali, Kannada, Malayalam)",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available with credit-based usage",
  },
};

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Languages Supported by Tarang for Voice Cloning",
  description: "Over 100 languages supported for AI voice cloning and text-to-speech",
  numberOfItems: POPULAR_LANG_NAMES.length,
  itemListElement: POPULAR_LANG_NAMES.map((lang, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: lang,
  })),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Tarang Blog — Voice AI Insights"
          href="/api/rss"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationSchema, webSiteSchema, softwareAppSchema, itemListSchema]),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
