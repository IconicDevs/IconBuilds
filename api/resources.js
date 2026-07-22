const { publishedResources, readMarketplaceData, sendJson } = require("./_storage");

module.exports = async function resources(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const { data, source } = await readMarketplaceData();
    const resources = publishedResources(data);
    const slug = req.query && req.query.slug;

    if (slug) {
      const resource = resources.find((item) => item.slug === slug);
      if (!resource) return sendJson(res, 404, { error: "Resource not found." });
      return sendJson(res, 200, { resource, source });
    }

    return sendJson(res, 200, {
      resources,
      source,
      updatedAt: data.updatedAt
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unable to load resources." });
  }
};
