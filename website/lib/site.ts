import type { Metadata } from "next";
function origin(value: string | undefined) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("SITE_URL must be a clean HTTPS origin");
  return url.origin;
}
function storeUrl(value: string | undefined, host: string) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password
  )
    throw new Error("Invalid store URL");
  return url.href;
}
export const site = {
  name: "CamelWords",
  url: origin(process.env.NEXT_PUBLIC_SITE_URL),
  appStore: storeUrl(process.env.NEXT_PUBLIC_APP_STORE_URL, "apps.apple.com"),
  playStore: storeUrl(
    process.env.NEXT_PUBLIC_PLAY_STORE_URL,
    "play.google.com",
  ),
};
export function metadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const fullTitle = title + " | CamelWords";
  return {
    title: { absolute: fullTitle },
    description,
    alternates: site.url ? { canonical: site.url + path } : undefined,
    openGraph: {
      title: fullTitle,
      description,
      locale: "ja_JP",
      type: "website",
      siteName: site.name,
      ...(site.url ? { url: site.url + path } : {}),
    },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
