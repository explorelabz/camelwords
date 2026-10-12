import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { metadata } from "../../lib/site";
import { levels } from "../../lib/content";
import { Breadcrumb, CrumbSchema, Download } from "../../components/site";
export const generateMetadata = () =>
  metadata(
    "TOEIC目標別の英単語学習ガイド",
    "TOEIC 600・730・860・990を目指す人へ。目標別の語彙学習の考え方と毎日の進め方を紹介します。",
    "/toeic/",
  );
export default function Page() {
  return (
    <main id="main">
      <div className="container">
        <Breadcrumb items={[{ label: "TOEIC単語学習" }]} />
        <CrumbSchema items={[{ name: "TOEIC単語学習", path: "/toeic/" }]} />
        <div className="page-heading">
          <span className="eyebrow">FIND YOUR NEXT GOAL</span>
          <h1>
            TOEIC単語学習を、
            <br />
            目標から考えよう。
          </h1>
          <p>
            まずは自分の理解を確かめるところから。
            <br />
            目標を手がかりに、毎日の学びを組み立てましょう。
          </p>
        </div>
        <div className="target-grid">
          {levels.map((l) => (
            <Link
              className={"target-card " + l.color}
              href={"/toeic/" + l.score + "/"}
              key={l.score}
            >
              <span>TOEIC VOCABULARY</span>
              <strong>
                {l.score}
                <small>点を目指す</small>
              </strong>
              <h2>{l.label}</h2>
              <p>{l.description}</p>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
        <p className="fine-print">
          スコアは学習の目安です。各ページは目標の達成や実際の出題を保証するものではありません。
        </p>
      </div>
      <Download />
    </main>
  );
}
