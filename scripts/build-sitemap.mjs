import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const toursDir = path.join(rootDir, "src", "lib", "data", "tours");
const versionFile = path.join(rootDir, "src", "lib", "config", "version.ts");
const sitemapPath = path.join(rootDir, "static", "sitemap.xml");

const SITE_URL = "https://audioguia.io";

async function getLastUpdate() {
  try {
    const source = await fs.readFile(versionFile, "utf8");
    const match = source.match(/LAST_UPDATE\s*=\s*"([^"]+)"/);
    if (match?.[1]) return match[1];
  } catch {
    // ignore and fallback
  }
  return new Date().toISOString().slice(0, 10);
}

async function getTourSlugs() {
  const entries = await fs.readdir(toursDir);
  const files = entries.filter((f) => f.toLowerCase().endsWith(".json"));
  const slugs = [];

  for (const file of files) {
    const fullPath = path.join(toursDir, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const data = JSON.parse(raw);
    const idFromFile = file.replace(/\.json$/i, "");
    const id = typeof data.id === "string" ? data.id : idFromFile;
    const slug = typeof data.slug === "string" ? data.slug : id;
    const status = data.status === "test" ? "test" : "prod";
    if (status === "prod") slugs.push(slug);
  }

  return Array.from(new Set(slugs)).sort((a, b) => a.localeCompare(b));
}

function renderEntry(loc, lastmod, changefreq, priority) {
  return [
    "  <url>",
    `    <loc>${SITE_URL}${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    "  </url>"
  ].join("\n");
}

async function main() {
  const lastmod = await getLastUpdate();
  const tourSlugs = await getTourSlugs();

  const baseEntries = [
    renderEntry("/", lastmod, "weekly", 1.0),
    renderEntry("/cerca", lastmod, "weekly", 0.8),
    renderEntry("/explorar", lastmod, "weekly", 0.9),
    renderEntry("/creditos", lastmod, "monthly", 0.5),
    renderEntry("/offline", lastmod, "weekly", 0.4)
  ];

  const trackEntries = tourSlugs.map((slug) => renderEntry(`/${slug}`, lastmod, "weekly", 0.9));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...baseEntries,
    ...trackEntries,
    "</urlset>",
    ""
  ].join("\n");

  await fs.writeFile(sitemapPath, xml, "utf8");
  console.log(`Sitemap updated: ${sitemapPath} (${baseEntries.length + trackEntries.length} URLs)`);
}

main().catch((err) => {
  console.error("Failed to build sitemap", err);
  process.exit(1);
});
