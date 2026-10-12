import Link from "next/link";
import { notFound } from "next/navigation";
import { levels } from "../../../lib/content";
import { metadata } from "../../../lib/site";
import { Breadcrumb, CrumbSchema, Download } from "../../../components/site";
export const dynamicParams = false;
export function generateStaticParams() {
  return levels.map((l) => ({ score: l.score }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ score: string }>;
}) {
  const { score } = await params;
  const l = levels.find((x) => x.score === score);
  return l
    ? metadata(
        "TOEIC " + score + "点を目指す英単語学習",
        l.description,
        "/toeic/" + score + "/",
      )
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ score: string }>;
}) {
  const { score } = await params;
  const l = levels.find((x) => x.score === score);
  if (!l) notFound();
  return (
    <main id="main">
      <div className="container">
        <Breadcrumb
          items={[
            { label: "TOEIC単語学習", href: "/toeic/" },
            { label: score + "点を目指す" },
          ]}
        />
        <CrumbSchema
          items={[
            { name: "TOEIC単語学習", path: "/toeic/" },
            { name: score + "点を目指す", path: "/toeic/" + score + "/" },
          ]}
        />
        <div className="detail-hero">
          <div>
            <span className="eyebrow">TOEIC VOCABULARY / {score}</span>
            <h1>
              TOEIC {score}点へ。
              <br />
              {l.label}
            </h1>
            <p>{l.description}</p>
          </div>
          <div className={"book-cover " + l.color} aria-hidden="true">
            <span>camelwords ⁕</span>
            <small>TOEIC VOCABULARY</small>
            <strong>{score}</strong>
            <span>{l.focus}</span>
            <div className="book-orbit" />
          </div>
        </div>
        <article className="reading">
          <h2>{score}点を目標にした、単語学習の考え方</h2>
          <p>{l.text}</p>
          <h2>毎日の学習で意識すること</h2>
          <ol>
            {l.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <h2>例文から、使う場面を考える</h2>
          <div className="example">
            <strong lang="en">{l.example}</strong>
            <span>{l.meaning}</span>
            <p lang="en">{l.sentence}</p>
            <p>{l.translation}</p>
          </div>
          <p className="fine-print">
            学習の進め方を示すオリジナル例文です。公式の出題例や正式な収録教材の案内ではありません。
          </p>
          <h2>CamelWordsで、自分のペースをつくる</h2>
          <p>
            知っている語をチェックし、復習を優先したプランで単語を確認。例文と音声読み上げを使い、回答に応じて次の復習へつなげます。正式教材と一般配信は準備中です。
          </p>
          <Link className="text-link" href="/guides/toeic-vocabulary-routine/">
            毎日の単語学習の組み立て方を読む →
          </Link>
          <aside className="editor-note">
            目標スコアは学習内容の目安です。得点を保証するものではありません。読解・リスニング・文法の学習と組み合わせてください。
          </aside>
          <h2>ほかの目標も見る</h2>
          <div className="level-links">
            {levels
              .filter((x) => x.score !== score)
              .map((x) => (
                <Link key={x.score} href={"/toeic/" + x.score + "/"}>
                  {x.score}点を目指す →
                </Link>
              ))}
          </div>
        </article>
      </div>
      <Download />
    </main>
  );
}
