import Link from "next/link";
import { guides } from "../../lib/content";
import { metadata } from "../../lib/site";
import { Breadcrumb, CrumbSchema, Download } from "../../components/site";
export const generateMetadata = () =>
  metadata(
    "TOEIC英単語の勉強法・学習ガイド",
    "単語学習の始め方、復習の進め方、目標別の学び方。TOEIC英単語を毎日の習慣にするためのヒントを紹介します。",
    "/guides/",
  );
export default function Page() {
  return (
    <main id="main">
      <div className="container">
        <Breadcrumb items={[{ label: "学習ガイド" }]} />
        <CrumbSchema items={[{ name: "学習ガイド", path: "/guides/" }]} />
        <div className="page-heading">
          <span className="eyebrow">THE LEARNING JOURNAL</span>
          <h1>
            学びを続ける、
            <br />
            小さなヒント。
          </h1>
          <p>
            TOEICの単語学習を、あなたの毎日に。
            <br />
            始め方から復習まで、迷ったときに読めるガイド。
          </p>
        </div>
        <div className="article-list">
          {guides.map((g, i) => (
            <Link href={"/guides/" + g.slug + "/"} key={g.slug}>
              <span className="article-number">0{i + 1}</span>
              <div>
                <span className="eyebrow">
                  {g.tag} · {g.minutes} MIN READ
                </span>
                <h2>{g.title}</h2>
                <p>{g.summary}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </div>
      <Download />
    </main>
  );
}
