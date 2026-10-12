import type { Metadata } from "next";
import { Header, Footer } from "../components/site";
import { site } from "../lib/site";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "CamelWords | TOEIC単語を、毎日の習慣に。",
    template: "%s | CamelWords",
  },
  description:
    "CamelWordsはTOEIC学習者のための単語学習アプリ。単語カードと復習プランで、毎日の語彙学習を支えます。現在配信準備中。",
  robots: { index: Boolean(site.url), follow: Boolean(site.url) },
  icons: { icon: "/favicon.svg" },
  ...(site.url ? { metadataBase: new URL(site.url) } : {}),
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main">
          本文へスキップ
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
