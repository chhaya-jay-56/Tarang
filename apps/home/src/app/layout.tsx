import type { Metadata } from "next";
import "@fontsource-variable/jetbrains-mono";
import "../index.css";

export const metadata: Metadata = {
  title: "Tarang",
  description: "Dub > Sub — Bring real emotion to your voice and your favorite shows, without losing the context.",
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
          href="https://fonts.cdnfonts.com/css/agrandir"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
