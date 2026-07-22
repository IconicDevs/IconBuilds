const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const api = require("./api/index.js");

const root = __dirname;
const port = Number(process.env.PORT || 4177);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function cleanPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safe = decoded.replace(/\\/g, "/").replace(/\.\.+/g, "");
  return safe === "/" ? "/index.html" : safe;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  if (url.pathname.startsWith("/api") || url.pathname === "/sitemap.xml" || /^\/resources\/[^/]+\/?$/.test(url.pathname)) {
    return api(req, res);
  }
  let filePath = path.join(root, cleanPath(url.pathname));
  try {
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat?.isDirectory()) filePath = path.join(filePath, "index.html");
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    const fallback = await fs.readFile(path.join(root, "404.html"), "utf8").catch(() => "Not found");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fallback);
  }
}

const server = http.createServer((req, res) => {
  serveStatic(req, res).catch((error) => {
    console.error("[IconBuilds dev server]", error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Local server error.");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`IconBuilds local server running at http://localhost:${port}`);
});

setInterval(() => {}, 60 * 60 * 1000);
