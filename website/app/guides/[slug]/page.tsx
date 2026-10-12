import Link from "next/link";
import { notFound } from "next/navigation";
import { guides } from "../../../lib/content";
import { metadata, site } from "../../../lib/site";
import {
  Breadcrumb,
  CrumbSchema,
  Download,
  JsonLd,
} from "../../../components/site";
export const dynamicParams = false;
export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = guides.find((x) => x.slug === slug);
  if (!g) return {};
  const meta = metadata(g.title, g.summary, "/guides/" + slug + "/");
  return { ...meta, openGraph: { ...meta.openGraph, type: "article" } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = guides.find((x) => x.slug === slug);
  if (!g) notFound();
  return (
    <main id="main">
      <div className="container">
        <Breadcrumb
          items={[
            { label: "学習ガイド", href: "/guides/" },
            { label: g.title },
          ]}
        />
        <CrumbSchema
          items={[
            { name: "学習ガイド", path: "/guides/" },
            { name: g.title, path: "/guides/" + slug + "/" },
          ]}
        />
        {site.url && (
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "Article",
              headline: g.title,
              description: g.summary,
              inLanguage: "ja",
              author: { "@type": "Organization", name: "CamelWords" },
              publisher: { "@type": "Organization", name: "CamelWords" },
              mainEntityOfPage: site.url + "/guides/" + slug + "/",
            }}
          />
        )}
        <article className="reading guide-reading">
          <span className="eyebrow">
            {g.tag} · {g.minutes} MIN READ
          </span>
          <h1>{g.title}</h1>
          <p className="article-intro">{g.summary}</p>
          <p className="byline">CamelWords · 学習ガイド</p>
          <nav className="toc" aria-label="記事の目次">
            <strong>この記事でわかること</strong>
            {g.sections.map((s, i) => (
              <a key={s.title} href={"#section-" + i}>
                {String(i + 1).padStart(2, "0")}　{s.title}
              </a>
            ))}
          </nav>
          {g.sections.map((s, i) => (
            <section key={s.title} id={"section-" + i}>
              <h2>{s.title}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
          <aside className="editor-note">
            この記事は学習方法の提案です。TOEIC公式の学習指針やスコア保証ではありません。自分の理解や生活に合わせて調整してください。
          </aside>
          <h2>あわせて読みたい</h2>
          {guides
            .filter((x) => x.slug !== slug)
            .map((x) => (
              <Link
                className="related-link"
                key={x.slug}
                href={"/guides/" + x.slug + "/"}
              >
                {x.title} →
              </Link>
            ))}
          <Link className="related-link" href="/toeic/">
            目標別のTOEIC単語学習ガイド →
          </Link>
        </article>
      </div>
      <Download />
    </main>
  );
}
