import type { MetadataRoute } from "next";
import { site } from "../lib/site";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return site.url
    ? {
        rules: { userAgent: "*", allow: "/" },
        sitemap: site.url + "/sitemap.xml",
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
