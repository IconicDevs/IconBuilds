const handler = require("./index.js");

module.exports = function actionProxy(action) {
  return function proxy(req, res) {
    const query = String(req.url || "").split("?").slice(1).join("?");
    req.url = `/api/index?action=${encodeURIComponent(action)}${query ? `&${query}` : ""}`;
    return handler(req, res);
  };
};
