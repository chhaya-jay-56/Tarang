import type { Metadata } from "next";
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
  icons: {
    icon: [
      { url: '/Logo.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/Logo.svg', type: 'image/svg+xml' }
    ]
  },
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

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Tarang support Hindi voice cloning?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Tarang fully supports Hindi voice cloning and text-to-speech. You can clone your voice in Hindi or convert any text to natural Hindi speech using AI. Hindi is one of Tarang's flagship languages with high-quality output.",
      },
    },
    {
      "@type": "Question",
      name: "What languages does Tarang support for text to speech?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tarang supports text-to-speech and voice cloning in over 100+ languages, including English, Hindi, Gujarati, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Spanish, French, German, Japanese, Chinese, Korean, Arabic, and many more.",
      },
    },
    {
      "@type": "Question",
      name: "Can I clone my voice and speak in a different language?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Tarang supports cross-lingual voice cloning. You can record your voice in one language and generate speech in any of 100+ supported languages while preserving your voice's unique characteristics, tone, and emotional quality.",
      },
    },
    {
      "@type": "Question",
      name: "Does Tarang support regional Indian languages like Gujarati or Marathi?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Tarang supports a wide range of regional Indian languages including Gujarati, Marathi, Tamil, Telugu, Bengali, Kannada, Malayalam, Odia, Panjabi, Urdu, Assamese, Konkani, Dogri, Manipuri, Santali, Kashmiri, Sindhi, Bodo, Maithili, and more. This is a key differentiator — most global voice cloning tools do not offer this level of Indian language coverage.",
      },
    },
  ],
};

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Languages Supported by Tarang for Voice Cloning",
  description: "Over 100+ languages supported for AI voice cloning and text-to-speech",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationSchema, webSiteSchema, softwareAppSchema, faqSchema, itemListSchema]),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
