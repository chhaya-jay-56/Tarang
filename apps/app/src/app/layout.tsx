import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Tarang - Voice Cloning & TTS",
  description: "Tarang provides instant voice cloning and text to speech capabilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={instrumentSerif.variable}>
        <body className="min-h-screen antialiased bg-background text-foreground w-full overflow-x-hidden font-body">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
