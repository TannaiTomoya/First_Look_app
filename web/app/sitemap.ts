import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  return ["", "/pricing", "/login", "/register", "/coaches"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
