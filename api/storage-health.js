const { readMarketplaceData, sendJson } = require("./_storage");

module.exports = async function storageHealth(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const { data, source } = await readMarketplaceData();
  return sendJson(res, 200, {
    ok: true,
    source,
    resourceCount: data.resources.length,
    updatedAt: data.updatedAt
  });
};
