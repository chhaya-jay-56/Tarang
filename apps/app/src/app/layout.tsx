import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { PostHogProvider, PostHogIdentifier } from "@/components/providers/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarang - Voice Cloning, Voice Creation & TTS",
  description: "Tarang provides instant AI voice cloning, voice creation, and text-to-speech (TTS) capabilities in 500+ languages.",
  keywords: ["voice cloning", "TTS", "voice creation", "500+ languages", "AI voice", "text to speech"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }} afterSignOutUrl="/sign-in">
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen antialiased bg-background text-foreground w-full overflow-x-hidden font-body">
          <PostHogProvider>
            <PostHogIdentifier />
            {children}
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
