const { publishedResources, readMarketplaceData } = require("./_storage");

module.exports = async function sitemap(req, res) {
  const site = "https://buildhub.gg";
  const { data } = await readMarketplaceData();
  const staticRoutes = ["", "/resources", "/free", "/premium", "/support", "/terms", "/privacy", "/refunds"];
  const resourceRoutes = publishedResources(data).map((resource) => `/resources/${resource.slug}`);
  const urls = [...staticRoutes, ...resourceRoutes]
    .map((route) => `<url><loc>${site}${route}</loc><changefreq>weekly</changefreq></url>`)
    .join("");

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
};
