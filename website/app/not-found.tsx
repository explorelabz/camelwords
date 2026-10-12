import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container page-heading">
      <span className="eyebrow">404 / A SMALL DETOUR</span>
      <h1>ページが見つかりません。</h1>
      <p>ホームから、もう一度はじめましょう。</p>
      <Link className="button" href="/">
        ホームへ戻る →
      </Link>
    </main>
  );
}
