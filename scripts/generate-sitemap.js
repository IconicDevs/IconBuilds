const fs = require("fs");
const path = require("path");
const CONFIG = require("../config.js");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "iconbuilds-db.json");
const outputPath = path.join(root, "sitemap.xml");

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { resources: [] };
  }
}

function siteUrl(pathname = "") {
  return `${CONFIG.site.url.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

function resourcePath(resource) {
  return `resources/?slug=${encodeURIComponent(resource.slug || resource.id)}`;
}

function urlEntry(loc, changefreq, priority, lastmod = new Date().toISOString()) {
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${xmlEscape(isoDate(lastmod))}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function buildSitemap() {
  const db = loadDb();
  const staticPages = [
    ["", "daily", "1.0"],
    ["resources/", "daily", "0.9"],
    ["free/", "daily", "0.8"],
    ["premium/", "daily", "0.8"],
    ["support/", "monthly", "0.5"],
    ["terms/", "yearly", "0.3"],
    ["privacy/", "yearly", "0.3"],
    ["refund/", "yearly", "0.3"],
    ["guidelines/", "yearly", "0.3"]
  ];
  const categoryPages = (CONFIG.categories || []).map((category) => [`resources/${category.id}/`, "weekly", "0.7"]);
  const resourcePages = (db.resources || [])
    .filter((resource) => resource.status === "published")
    .map((resource) => [resourcePath(resource), "weekly", "0.85", resource.updatedAt || resource.publishedAt || resource.createdAt]);

  const urls = [...staticPages, ...categoryPages, ...resourcePages];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([pathname, changefreq, priority, lastmod]) => urlEntry(siteUrl(pathname), changefreq, priority, lastmod)).join("\n")}\n</urlset>\n`;
}

fs.writeFileSync(outputPath, buildSitemap());
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);