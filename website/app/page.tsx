import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  RotateCcw,
  ListChecks,
  Headphones,
} from "lucide-react";
import { metadata, site } from "../lib/site";
import { guides, levels } from "../lib/content";
import { StudyDemo, LevelTabs, FAQ } from "../components/interactive";
import { CheckLine, Download, JsonLd, MoreLink } from "../components/site";
export const generateMetadata = () =>
  metadata(
    "TOEIC単語を、毎日の習慣に。",
    "CamelWordsはTOEIC学習者のための英単語アプリ。600・730・860・990の目標別学習と、回答に合わせた復習で毎日の一歩を支えます。iOS・Android向けに開発中。",
    "/",
  );
export default function Page() {
  return (
    <main id="main">
      {site.url && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "CamelWords",
            url: site.url,
            inLanguage: "ja",
            description: "TOEIC単語学習アプリCamelWordsの公式サイト",
          }}
        />
      )}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-label">
              <span /> TOEIC学習の、新しい習慣。
            </div>
            <h1>
              英単語を、
              <br />
              あなたの<span className="underline">日常に。</span>
            </h1>
            <p>
              一度にたくさんより、毎日少しずつ。
              <br />
              覚える。振り返る。また一歩進む。
              <br />
              CamelWordsと、自分のペースで続けよう。
            </p>
            <div className="hero-actions">
              <Link className="button" href="#download">
                CamelWordsについて <ArrowUpRight size={18} />
              </Link>
              <a className="play-link" href="#how-it-works">
                使い方を見る <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-notes">
              <CheckLine>iOS・Android向けに開発中</CheckLine>
              <span>正式配信準備中</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-circle" />
            <div className="art-caption">SMALL STEPS. BIG POSSIBILITIES.</div>
            <div className="floating-note note-top">
              <span className="note-icon">
                <RotateCcw size={21} />
              </span>
              <span>
                <small>記憶に合わせて</small>
                <strong>ちょうどいい復習を。</strong>
              </span>
            </div>
            <StudyDemo />
            <div className="floating-note note-bottom">
              <span className="sparkle">✳</span>
              <span>
                <small>今日の小さな積み重ねが</small>
                <strong>明日の、自信になる。</strong>
              </span>
            </div>
            <span className="demo-caption">タップして、単語カードを体験</span>
          </div>
        </div>
        <div className="container hero-foot">
          <span>MADE FOR YOUR EVERYDAY</span>
          <span>
            単語カード <i>／</i> 熟識チェック <i>／</i> 復習プラン <i>／</i>{" "}
            学習記録
          </span>
          <a href="#features" aria-label="特長へ進む">
            ↓
          </a>
        </div>
      </section>
      <section className="section container" id="features">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WHY CAMELWORDS</span>
            <h2>
              がんばりすぎない。
              <br />
              でも、ちゃんと積み重なる。
            </h2>
          </div>
          <p>
            「今日は何を勉強しよう？」に迷わない。
            <br />
            自分に必要な単語と、今日の復習に向き合える。
            <br />
            続けるためのシンプルさを、大切にしました。
          </p>
        </div>
        <div className="feature-grid">
          {[
            {
              icon: RotateCcw,
              n: "01",
              title: "覚えっぱなしに、しない。",
              text: "回答に合わせて、次の復習を調整。新しい単語の前に、今のあなたに必要な復習から。",
              visual: (
                <div className="review-path">
                  <span>今日</span>
                  <i />
                  <span>復習</span>
                  <i />
                  <span className="active">次の一歩</span>
                </div>
              ),
            },
            {
              icon: ListChecks,
              n: "02",
              title: "知っている単語は、先へ。",
              text: "学習前に、知っている単語をチェック。まだ曖昧な単語に、今日の時間を使おう。",
              visual: (
                <div className="mini-words">
                  <span>
                    appointment <small>✓ 熟識</small>
                  </span>
                  <span>
                    available <small>これから学ぶ →</small>
                  </span>
                </div>
              ),
            },
            {
              icon: Headphones,
              n: "03",
              title: "音と例文で、言葉に出会う。",
              text: "訳だけでなく、使われる場面まで。例文と音声読み上げで、理解を確かめよう。",
              visual: (
                <div className="audio-bars" aria-hidden="true">
                  {[18, 32, 45, 28, 54, 37, 23, 44, 30, 16, 28, 40].map(
                    (n, i) => (
                      <i key={i} style={{ height: n }} />
                    ),
                  )}
                </div>
              ),
            },
          ].map((f) => (
            <article className="feature-card" key={f.n}>
              <div className="feature-top">
                <f.icon size={25} />
                <span>{f.n}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <div className="feature-visual">{f.visual}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div className="container how-grid">
          <div>
            <span className="eyebrow">A LITTLE, EVERY DAY</span>
            <h2>
              今日の学習は、
              <br />
              この3ステップ。
            </h2>
            <p>
              忙しい日も、余裕がある日も。
              <br />
              あなたの毎日に、学びのリズムを。
            </p>
            <span className="large-asterisk" aria-hidden="true">
              ✳
            </span>
          </div>
          <ol className="steps">
            {[
              [
                "今日のプランを開く",
                "まずは復習から。今日取り組む単語をまとめて確認。",
              ],
              [
                "思い出して、確かめる",
                "意味を隠して考える。例文と音声で理解をチェック。",
              ],
              [
                "自分の理解を記録する",
                "難しかった単語は、また復習。今日の一歩を記録に残す。",
              ],
            ].map(([h, p], i) => (
              <li key={h}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="section container" id="levels">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR NEXT GOAL</span>
            <h2>目指す場所から、はじめよう。</h2>
          </div>
          <MoreLink href="/toeic/">目標別の学習ガイド</MoreLink>
        </div>
        <LevelTabs />
        <div className="level-links">
          {levels.map((l) => (
            <Link href={"/toeic/" + l.score + "/"} key={l.score}>
              TOEIC {l.score}点の単語学習 <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
        <p className="fine-print">
          目標スコアは学習カテゴリーの目安です。スコア達成を保証するものではありません。正式教材は準備中です。
        </p>
      </section>
      <section className="guide-section">
        <div className="container section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE LEARNING JOURNAL</span>
              <h2>続けるヒント、集めました。</h2>
            </div>
            <MoreLink href="/guides/">学習ガイドを読む</MoreLink>
          </div>
          <div className="guide-grid">
            {guides.map((g, i) => (
              <Link
                href={"/guides/" + g.slug + "/"}
                className="guide-card"
                key={g.slug}
              >
                <div className={"guide-art art-" + i} aria-hidden="true">
                  {i === 0 ? (
                    <>
                      <span className="art-word">
                        a little,
                        <br />
                        <em>every day.</em>
                      </span>
                      <span className="art-star">✳</span>
                    </>
                  ) : i === 1 ? (
                    <>
                      <span className="art-word">
                        learn.
                        <br />
                        review.
                        <br />
                        <em>repeat.</em>
                      </span>
                      <RotateCcw size={76} />
                    </>
                  ) : (
                    <>
                      <span className="art-word">
                        your next
                        <br />
                        <em>chapter.</em>
                      </span>
                      <span className="art-numbers">600 → 990</span>
                    </>
                  )}
                </div>
                <div className="guide-meta">
                  <span>{g.tag}</span>
                  <span>{g.minutes} min read</span>
                </div>
                <h3>{g.title}</h3>
                <p>{g.summary}</p>
                <span className="guide-arrow">
                  <ArrowUpRight size={22} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section container faq-section" id="faq">
        <div>
          <span className="eyebrow">GOOD TO KNOW</span>
          <h2>よくある質問</h2>
          <p>はじめる前の、気になること。</p>
        </div>
        <FAQ />
      </section>
      <Download />
    </main>
  );
}
