import type { Metadata } from "next";
import "@fontsource-variable/jetbrains-mono";
import "../index.css";

export const metadata: Metadata = {
  title: "Tarang",
  description: "Voice > Text — Bring real emotion to your voice, without losing the context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
