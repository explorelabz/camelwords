import Link from "next/link";
import { ArrowUpRight, ArrowRight, Check, Smartphone } from "lucide-react";
import { site } from "../lib/site";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="CamelWords ホーム">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 16V11C3 7 7 7 8 11C10 6 14 6 16 11L18 7V4H21V14H18L16 17H6L5 20M16 17L18 20M8 17L9 20" />
      </svg>
      <span>
        camelwords<span className="brand-star">⁕</span>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="header">
      <div className="container nav">
        <Brand />
        <nav aria-label="メインナビゲーション">
          <Link href="/#features">特長</Link>
          <Link href="/toeic/">目標から探す</Link>
          <Link href="/guides/">学習ガイド</Link>
          <Link href="/#faq">よくある質問</Link>
        </nav>
        <Link className="button small" href="/#download">
          アプリについて <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>毎日の一歩が、あなたの語彙になる。</p>
          </div>
          <div className="footer-links">
            <Link href="/toeic/">TOEIC単語学習</Link>
            <Link href="/guides/">学習ガイド</Link>
            <Link href="/#faq">よくある質問</Link>
            <Link href="/#download">配信について</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} CamelWords</span>
          <span>
            TOEICはETSの登録商標です。本サービスはETSによる承認・推奨を受けていません。
          </span>
        </div>
      </div>
    </footer>
  );
}
export function Download() {
  const available = site.appStore || site.playStore;
  return (
    <section className="download container" id="download">
      <div>
        <span className="eyebrow">YOUR NEXT SMALL STEP</span>
        <h2>
          今日の一歩が、
          <br />
          明日の「わかる」に。
        </h2>
        <p>
          あなたのペースで続ける、TOEIC単語学習。
          <br />
          {available
            ? "ストアで最新の配信情報をご確認ください。"
            : "CamelWordsは、ただいま配信に向けて準備中です。"}
        </p>
      </div>
      <div className="download-options">
        <Smartphone size={34} strokeWidth={1.4} />
        <strong>
          {available
            ? "CamelWordsを、あなたの毎日に。"
            : "もうすぐ、あなたの毎日に。"}
        </strong>
        <div className="store-buttons">
          {site.appStore ? (
            <a href={site.appStore} className="store">
              App Store <ArrowUpRight size={16} />
            </a>
          ) : (
            <span className="store">
              iOS <small>配信準備中</small>
            </span>
          )}
          {site.playStore ? (
            <a href={site.playStore} className="store">
              Google Play <ArrowUpRight size={16} />
            </a>
          ) : (
            <span className="store">
              Android <small>配信準備中</small>
            </span>
          )}
        </div>
        <small>
          {available
            ? "対応環境と料金は各ストアをご確認ください。"
            : "配信日・料金は決まり次第お知らせします。"}
        </small>
      </div>
    </section>
  );
}
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="パンくずリスト">
      <Link href="/">ホーム</Link>
      {items.map((item, i) => (
        <span key={i}>
          <span aria-hidden="true"> / </span>
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
export function CrumbSchema({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return site.url ? (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "ホーム", path: "/" }, ...items].map(
          (x, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: x.name,
            item: site.url + x.path,
          }),
        ),
      }}
    />
  ) : null;
}
export function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <span className="check-line">
      <Check size={16} />
      {children}
    </span>
  );
}
export function MoreLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowRight size={18} />
    </Link>
  );
}
