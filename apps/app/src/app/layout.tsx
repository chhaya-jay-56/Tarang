import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { PostHogProvider, PostHogIdentifier } from "@/components/providers/PostHogProvider";
import "./globals.css";

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
    <ClerkProvider appearance={{ baseTheme: dark }} afterSignOutUrl="/">
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
