const {
  isAdmin,
  normalizeResource,
  readBody,
  readMarketplaceData,
  sendJson,
  writeMarketplaceData
} = require("./_storage");

module.exports = async function adminResources(req, res) {
  if (!isAdmin(req)) {
    return sendJson(res, 403, { error: "Administrator access is required." });
  }

  try {
    if (req.method === "GET") {
      const result = await readMarketplaceData();
      return sendJson(res, 200, result);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const resource = normalizeResource(body);
      const { data } = await readMarketplaceData();

      if (data.resources.some((item) => item.slug === resource.slug)) {
        return sendJson(res, 409, { error: "A resource with this slug already exists." });
      }

      const saved = await writeMarketplaceData({
        ...data,
        resources: [resource, ...data.resources]
      });

      return sendJson(res, 201, { resource, updatedAt: saved.updatedAt });
    }

    if (req.method === "PUT") {
      const id = req.query && req.query.id;
      if (!id) return sendJson(res, 400, { error: "Resource id is required." });

      const body = await readBody(req);
      const { data } = await readMarketplaceData();
      const existing = data.resources.find((item) => item.id === id);
      if (!existing) return sendJson(res, 404, { error: "Resource not found." });

      const updated = normalizeResource({ ...existing, ...body, id: existing.id });
      const duplicate = data.resources.some((item) => item.id !== id && item.slug === updated.slug);
      if (duplicate) return sendJson(res, 409, { error: "A resource with this slug already exists." });

      const saved = await writeMarketplaceData({
        ...data,
        resources: data.resources.map((item) => (item.id === id ? updated : item))
      });

      return sendJson(res, 200, { resource: updated, updatedAt: saved.updatedAt });
    }

    if (req.method === "DELETE") {
      const id = req.query && req.query.id;
      if (!id) return sendJson(res, 400, { error: "Resource id is required." });

      const { data } = await readMarketplaceData();
      const next = data.resources.filter((item) => item.id !== id);
      if (next.length === data.resources.length) {
        return sendJson(res, 404, { error: "Resource not found." });
      }

      const saved = await writeMarketplaceData({ ...data, resources: next });
      return sendJson(res, 200, { ok: true, updatedAt: saved.updatedAt });
    }

    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Admin resource action failed." });
  }
};
