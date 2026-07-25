const fs = require("fs");
const path = require("path");
const CONFIG = require("../config.js");
const { __seo: seo } = require("../api/index.js");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "iconbuilds-db.json");

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { resources: [] };
  }
}

function writeText(relativePath, text) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return target;
}

function removeStaleResourcePages(db) {
  const resourcesRoot = path.join(root, "resources");
  const live = new Set(
    (db.resources || [])
      .filter((resource) => resource.status === "published")
      .map((resource) => resource.slug || resource.id)
      .filter(Boolean)
  );
  if (!fs.existsSync(resourcesRoot)) return;
  for (const entry of fs.readdirSync(resourcesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const keep = CONFIG.categories.some((category) => category.id === entry.name) || live.has(entry.name);
    if (!keep) fs.rmSync(path.join(resourcesRoot, entry.name), { recursive: true, force: true });
  }
}

function buildSeoFiles() {
  const db = loadDb();
  removeStaleResourcePages(db);
  const written = [];

  written.push(writeText("sitemap.xml", seo.sitemapXml(db)));
  written.push(writeText("resources/index.html", seo.listingPageHtml("resources", db)));
  written.push(writeText("free/index.html", seo.listingPageHtml("free", db)));
  written.push(writeText("premium/index.html", seo.listingPageHtml("premium", db)));

  for (const category of CONFIG.categories || []) {
    written.push(writeText(`resources/${category.id}/index.html`, seo.categoryPageHtml(category, db)));
  }

  for (const resource of (db.resources || []).filter((item) => item.status === "published")) {
    written.push(writeText(seo.resourcePageFilePath(resource), seo.resourcePageHtml(resource)));
  }

  return written;
}

const written = buildSeoFiles();
console.log(`Wrote ${written.length} SEO files`);
