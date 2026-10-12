"use client";
import * as Accordion from "@radix-ui/react-accordion";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Plus,
  ArrowRight,
  RotateCcw,
  Check,
  BookOpen,
  BarChart3,
  Home,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { faqs, levels } from "../lib/content";
export function FAQ() {
  return (
    <Accordion.Root type="single" collapsible className="faq-list">
      {faqs.map((faq, i) => (
        <Accordion.Item className="faq-item" value={"q" + i} key={faq.q}>
          <Accordion.Header>
            <Accordion.Trigger className="faq-trigger">
              <span>
                <span className="q-mark">Q.</span>
                {faq.q}
              </span>
              <Plus size={20} aria-hidden="true" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content forceMount className="faq-answer">
            <p>{faq.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
export function LevelTabs() {
  return (
    <Tabs.Root defaultValue="600" className="level-tabs">
      <Tabs.List className="level-tablist" aria-label="TOEICの目標スコア">
        {levels.map((l) => (
          <Tabs.Trigger key={l.score} value={l.score}>
            {l.score}
            <span>点を目指す</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {levels.map((l) => (
        <Tabs.Content value={l.score} key={l.score} className="level-panel">
          <div>
            <span className="eyebrow">TOEIC VOCABULARY / {l.score}</span>
            <h3>{l.label}</h3>
            <p>{l.description}</p>
            <Link className="text-link" href={"/toeic/" + l.score + "/"}>
              {l.score}点に向けた学習を見る <ArrowRight size={18} />
            </Link>
          </div>
          <div className={"book-cover " + l.color} aria-hidden="true">
            <span>camelwords ⁕</span>
            <small>TOEIC VOCABULARY</small>
            <strong>{l.score}</strong>
            <span>{l.focus}</span>
            <div className="book-orbit" />
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
export function StudyDemo() {
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="phone">
      <div className="phone-status" aria-hidden="true">
        <span>9:41</span>
        <span>••• ▰</span>
      </div>
      <div className="phone-head">
        <span className="mini-logo">camelwords ⁕</span>
        <span>今日の学習</span>
      </div>
      <div className="phone-progress">
        <span>今日も、少しずつ。</span>
        <strong>
          {done ? "13" : "12"} <small>/ 30</small>
        </strong>
      </div>
      <div className="progress-track">
        <span style={{ width: done ? "43%" : "40%" }} />
      </div>
      <div className="word-card">
        <span className="word-label">
          TOEIC 基礎 <span>名詞</span>
        </span>
        <span className="word">progress</span>
        <span className="pronunciation">/ˈprɑːɡres/</span>
        <div className="word-answer" aria-live="polite">
          {done ? (
            <>
              <Check size={30} />
              <strong>今日も、一歩前へ。</strong>
              <span>体験用のカードです</span>
            </>
          ) : revealed ? (
            <>
              <strong>進歩、前進</strong>
              <span>Small steps make progress.</span>
              <span>小さな一歩が、前進になる。</span>
            </>
          ) : (
            <>
              <span className="hint">意味を思い出してみよう</span>
              <button
                onClick={() => setRevealed(true)}
                className="reveal-button"
              >
                意味を見る <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="rating-row">
        {done ? (
          <button
            className="demo-reset"
            onClick={() => {
              setDone(false);
              setRevealed(false);
            }}
          >
            <RotateCcw size={14} /> もう一度体験する
          </button>
        ) : (
          <>
            <button disabled={!revealed} onClick={() => setRevealed(false)}>
              もう一度
            </button>
            <button disabled={!revealed} onClick={() => setDone(true)}>
              覚えた <Check size={14} />
            </button>
          </>
        )}
      </div>
      <div className="phone-bottom" aria-hidden="true">
        <span>
          <Home />
          ホーム
        </span>
        <span>
          <BookOpen />
          単語帳
        </span>
        <span>
          <BarChart3 />
          記録
        </span>
      </div>
      <div className="home-indicator" />
    </div>
  );
}
