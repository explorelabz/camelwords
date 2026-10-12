import type { MetadataRoute } from "next";
import { site } from "../lib/site";
import { levels, guides } from "../lib/content";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.url) return [];
  return [
    "/",
    "/toeic/",
    "/guides/",
    ...levels.map((l) => "/toeic/" + l.score + "/"),
    ...guides.map((g) => "/guides/" + g.slug + "/"),
  ].map((path) => ({ url: site.url + path }));
}
