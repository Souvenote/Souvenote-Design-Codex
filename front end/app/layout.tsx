import type { Metadata } from "next";
import "./styles/colors_and_type.css";
import "./styles/site.css";
import "./styles/auth.css";
import "./styles/options.css";
import "./styles/landing-chrome.css";
import "./styles/next-app.css";

export const metadata: Metadata = {
  title: "Souvenote",
  description: "A production-ready Next.js conversion of the Souvenote Claude Designs handoff.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
