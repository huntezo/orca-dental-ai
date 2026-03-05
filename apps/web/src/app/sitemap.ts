import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://orcadental.ai";
  const locales = ["en", "ar"];
  
  const routes = [
    "",
    "/about",
    "/services",
    "/blog",
    "/partners",
    "/faq",
    "/contact",
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Add main routes for each locale
  for (const locale of locales) {
    for (const route of routes) {
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "" ? "daily" : "weekly",
        priority: route === "" ? 1 : 0.8,
      });
    }
  }

  return sitemapEntries;
}
