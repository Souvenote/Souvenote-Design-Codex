import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "../styles/landing.css";
import "../styles/app.css";
import { PageBackground } from "@/components/layout/PageBackground";

export const metadata: Metadata = {
  title: "Souvenote — A card worth keeping",
  description:
    "Generate personalized cards and custom songs. Because the card you send should be as unique as they are.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Lobster&display=swap"
        />
      </head>
      <body>
        <PageBackground />
        {children}
      </body>
    </html>
  );
}
