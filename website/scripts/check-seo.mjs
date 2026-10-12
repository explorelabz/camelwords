import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const originArg = process.argv.find((a) => a.startsWith("--origin="));
const origin = originArg?.slice(9).replace(/\/$/, "");
const paths = [
  "/",
  "/toeic/",
  "/guides/",
  "/toeic/600/",
  "/toeic/730/",
  "/toeic/860/",
  "/toeic/990/",
  "/guides/toeic-vocabulary-routine/",
  "/guides/spaced-review/",
  "/guides/choose-toeic-level/",
];
const root = resolve("out");
const read = (p) => readFileSync(resolve(root, "." + p + "index.html"), "utf8");
const tags = (html, tag) =>
  [...html.matchAll(new RegExp("<" + tag + "\\b[^>]*>", "g"))].map((m) =>
    Object.fromEntries(
      [...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]),
    ),
  );
const titles = new Set(),
  descriptions = new Set();
for (const path of paths) {
  const html = read(path);
  const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  const title = body.match(/<title>([^<]+)<\/title>/)?.[1];
  assert(title?.includes("CamelWords"), path + ": branded title missing");
  assert(!titles.has(title), path + ": duplicate title");
  titles.add(title);
  assert.equal(
    (body.match(/<h1\b/g) || []).length,
    1,
    path + ": expected one h1",
  );
  assert(
    body.includes('<html lang="ja"'),
    path + ": Japanese language missing",
  );
  const metas = tags(body, "meta"),
    links = tags(body, "link");
  const desc = metas.find((m) => m.name === "description")?.content;
  assert(desc && desc.length > 25, path + ": description missing");
  assert(!descriptions.has(desc), path + ": duplicate description");
  descriptions.add(desc);
  assert(
    metas.some((m) => m.property === "og:title" && m.content === title),
    path + ": Open Graph title mismatch",
  );
  assert(
    metas.some((m) => m.name === "twitter:title" && m.content === title),
    path + ": Twitter title mismatch",
  );
  const robots = metas.find((m) => m.name === "robots")?.content;
  if (origin) {
    assert(
      robots && !robots.includes("noindex"),
      path + ": production is noindex",
    );
    assert(
      links.some((l) => l.rel === "canonical" && l.href === origin + path),
      path + ": canonical mismatch",
    );
    const schemas = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]));
    assert(schemas.length > 0, path + ": schema missing");
    if (path !== "/")
      assert(
        schemas.some((s) => s["@type"] === "BreadcrumbList"),
        path + ": breadcrumbs missing",
      );
    if (path.startsWith("/guides/") && path !== "/guides/")
      assert(
        schemas.some((s) => s["@type"] === "Article"),
        path + ": article schema missing",
      );
  } else {
    assert(robots?.includes("noindex"), path + ": preview should be noindex");
    assert(
      !links.some((l) => l.rel === "canonical"),
      path + ": preview has a canonical",
    );
  }
  for (const a of tags(body, "a")) {
    if (!a.href || (!a.href.startsWith("/") && !a.href.startsWith("#")))
      continue;
    const url = new URL(a.href, "https://local.test" + path);
    if (url.pathname.startsWith("/_next/")) continue;
    const file = resolve(
      root,
      "." + url.pathname + (url.pathname.endsWith("/") ? "index.html" : ""),
    );
    assert(existsSync(file), path + ": broken link " + a.href);
    if (url.hash) {
      const target = readFileSync(file, "utf8");
      assert(
        target.includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'),
        path + ": broken anchor " + a.href,
      );
    }
  }
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
  assert(
    main.replace(/<[^>]+>/g, "").length > 300,
    path + ": body needs JavaScript or lacks content",
  );
}
const robots = readFileSync(resolve(root, "robots.txt"), "utf8");
const sitemap = readFileSync(resolve(root, "sitemap.xml"), "utf8");
if (origin) {
  assert(robots.includes("Allow: /"));
  assert(robots.includes(origin + "/sitemap.xml"));
  for (const p of paths)
    assert(sitemap.includes("<loc>" + origin + p + "</loc>"));
} else {
  assert(robots.includes("Disallow: /"));
  assert(!sitemap.includes("<loc>"));
}
assert(existsSync(resolve(root, "404.html")));
console.log(
  "PASS: 10 static pages, unique metadata, social metadata, internal links and anchors, HTML content, " +
    (origin
      ? "canonical URLs + structured data + sitemap"
      : "preview noindex") +
    ".",
);
