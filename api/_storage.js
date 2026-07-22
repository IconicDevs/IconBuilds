const crypto = require("crypto");

const DATA_KEY = "iconbuilds:marketplace:v1";
const EMPTY_DATA = {
  schemaVersion: 1,
  resources: [],
  updatedAt: new Date(0).toISOString()
};

async function readMarketplaceData() {
  try {
    const primary = await readVercelKv();
    if (primary) return { data: primary, source: "vercel-kv" };
  } catch (error) {
    console.warn("Primary KV read failed:", error.message);
  }

  try {
    const backup = await readGitHubBackup();
    if (backup) return { data: backup, source: "github-backup" };
  } catch (error) {
    console.warn("GitHub backup read failed:", error.message);
  }

  return { data: EMPTY_DATA, source: "empty" };
}

async function writeMarketplaceData(data) {
  const next = {
    schemaVersion: 1,
    resources: Array.isArray(data.resources) ? data.resources : [],
    updatedAt: new Date().toISOString()
  };

  await writeVercelKv(next);
  await writeGitHubBackup(sanitizeBackup(next));
  return next;
}

async function readVercelKv() {
  const config = getKvConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/get/${encodeURIComponent(DATA_KEY)}`, {
    headers: { Authorization: `Bearer ${config.token}` }
  });

  if (!response.ok) return null;
  const payload = await response.json();
  if (!payload.result) return null;
  return typeof payload.result === "string" ? JSON.parse(payload.result) : payload.result;
}

async function writeVercelKv(data) {
  const config = getKvConfig();
  if (!config) return;

  const response = await fetch(`${config.url}/set/${encodeURIComponent(DATA_KEY)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vercel KV write failed: ${response.status} ${detail}`);
  }
}

async function readGitHubBackup() {
  const config = getGitHubConfig();
  if (!config) return null;

  const response = await fetch(`${githubContentUrl(config)}?ref=${encodeURIComponent(config.branch)}`, {
    headers: githubHeaders(config.token)
  });

  if (!response.ok) return null;
  const payload = await response.json();
  if (!payload.content) return null;

  const encrypted = Buffer.from(payload.content, "base64").toString("utf8");
  return decryptJson(encrypted, config.encryptionKey);
}

async function writeGitHubBackup(data) {
  const config = getGitHubConfig();
  if (!config) return;

  const encrypted = encryptJson(data, config.encryptionKey);
  const content = Buffer.from(JSON.stringify(encrypted, null, 2), "utf8").toString("base64");
  const sha = await getGitHubFileSha(config);

  const response = await fetch(githubContentUrl(config), {
    method: "PUT",
    headers: {
      ...githubHeaders(config.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `IconBuilds encrypted marketplace backup ${data.updatedAt}`,
      branch: config.branch,
      content,
      sha
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub backup write failed: ${response.status} ${detail}`);
  }
}

async function getGitHubFileSha(config) {
  const response = await fetch(`${githubContentUrl(config)}?ref=${encodeURIComponent(config.branch)}`, {
    headers: githubHeaders(config.token)
  });

  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`GitHub backup lookup failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.sha;
}

function sanitizeBackup(data) {
  return {
    schemaVersion: 1,
    updatedAt: data.updatedAt,
    resources: data.resources.map((resource) => ({
      ...resource,
      coverImage: safePublicAsset(resource.coverImage),
      showcaseImages: (resource.showcaseImages || []).map(safePublicAsset).filter(Boolean),
      file: resource.file
        ? {
            fileName: resource.file.fileName,
            fileSizeBytes: resource.file.fileSizeBytes,
            sha256: resource.file.sha256
          }
        : undefined
    }))
  };
}

function safePublicAsset(value) {
  if (!value) return undefined;
  const lowered = String(value).toLowerCase();
  if (lowered.startsWith("data:")) return undefined;
  if (lowered.includes("token=") || lowered.includes("signature=") || lowered.includes("x-amz-")) {
    return undefined;
  }
  return value;
}

function normalizeResource(input) {
  if (!input || typeof input !== "object") throw new Error("Resource payload is required.");
  if (!String(input.title || "").trim()) throw new Error("Resource title is required.");
  if (!String(input.summary || "").trim()) throw new Error("Resource summary is required.");
  if (!String(input.categoryId || "").trim()) throw new Error("Resource category is required.");

  const title = String(input.title).trim().slice(0, 80);
  const free = input.free !== false;

  return {
    id: input.id || crypto.randomUUID(),
    title,
    slug: slugify(input.slug || title),
    summary: String(input.summary).trim().slice(0, 180),
    categoryId: String(input.categoryId).trim(),
    status: ["draft", "published", "scheduled", "archived"].includes(input.status) ? input.status : "draft",
    featured: Boolean(input.featured),
    free,
    priceCents: free ? 0 : Math.max(0, Number(input.priceCents || 0)),
    currency: String(input.currency || "USD"),
    ownershipLabel: String(input.ownershipLabel || "IconRealms").slice(0, 80),
    tags: list(input.tags).slice(0, 24),
    coverImage: cleanOptionalString(input.coverImage),
    showcaseImages: list(input.showcaseImages).slice(0, 4),
    youtubeTrailerUrl: cleanOptionalString(input.youtubeTrailerUrl),
    descriptionHtml: sanitizeHtml(String(input.descriptionHtml || "")),
    dependencies: Array.isArray(input.dependencies) ? input.dependencies.slice(0, 30) : [],
    supportedVersions: list(input.supportedVersions),
    supportedSoftware: list(input.supportedSoftware),
    currentVersion: String(input.currentVersion || "1.0.0").slice(0, 30),
    releaseDate: cleanOptionalString(input.releaseDate),
    lastUpdatedAt: new Date().toISOString(),
    seoTitle: cleanOptionalString(input.seoTitle),
    seoDescription: cleanOptionalString(input.seoDescription),
    imageAlt: cleanOptionalString(input.imageAlt),
    file: input.file ? sanitizeFile(input.file) : undefined,
    updates: Array.isArray(input.updates) ? input.updates.slice(0, 60) : [],
    downloads: Math.max(0, Number(input.downloads || 0)),
    purchases: Math.max(0, Number(input.purchases || 0)),
    ratingAverage: Number(input.ratingAverage || 0),
    reviewCount: Math.max(0, Number(input.reviewCount || 0))
  };
}

function publishedResources(data) {
  return data.resources
    .filter((resource) => resource.status === "published")
    .map((resource) => ({
      ...resource,
      downloads: Number(resource.downloads || 0),
      purchases: Number(resource.purchases || 0),
      reviewCount: Number(resource.reviewCount || 0),
      ratingAverage: Number(resource.ratingAverage || 0)
    }));
}

function sanitizeFile(file) {
  return {
    fileName: String(file.fileName || "").slice(0, 160),
    fileSizeBytes: Math.max(0, Number(file.fileSizeBytes || 0)),
    sha256: cleanOptionalString(file.sha256),
    storageKey: cleanOptionalString(file.storageKey)
  };
}

function sanitizeHtml(html) {
  return html
    .replace(/<\/?(script|iframe|object|embed|form|input|button|style|link|meta)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:.*?\2/gi, "")
    .replace(/(href|src)\s*=\s*(['"])\s*data:.*?\2/gi, "");
}

function encryptJson(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final()
  ]);

  return {
    algorithm: "aes-256-gcm",
    createdAt: new Date().toISOString(),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  };
}

function decryptJson(payload, secret) {
  const parsed = JSON.parse(payload);
  if (parsed.algorithm !== "aes-256-gcm") throw new Error("Unsupported backup encryption.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(secret),
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function key(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

function getKvConfig() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return {
    url: process.env.KV_REST_API_URL.replace(/\/$/, ""),
    token: process.env.KV_REST_API_TOKEN
  };
}

function getGitHubConfig() {
  if (!process.env.GITHUB_BACKUP_TOKEN || !process.env.GITHUB_BACKUP_REPO || !process.env.GITHUB_BACKUP_ENCRYPTION_KEY) {
    return null;
  }
  return {
    token: process.env.GITHUB_BACKUP_TOKEN,
    repo: process.env.GITHUB_BACKUP_REPO,
    branch: process.env.GITHUB_BACKUP_BRANCH || "main",
    path: process.env.GITHUB_BACKUP_PATH || "iconbuilds/marketplace.encrypted.json",
    encryptionKey: process.env.GITHUB_BACKUP_ENCRYPTION_KEY
  };
}

function githubContentUrl(config) {
  const encodedPath = encodeURIComponent(config.path).replace(/%2F/g, "/");
  return `https://api.github.com/repos/${config.repo}/contents/${encodedPath}`;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function isAdmin(req) {
  const apiKey = process.env.ADMIN_API_KEY;
  const sentKey = req.headers["x-admin-key"];
  if (apiKey && sentKey && apiKey === sentKey) return true;

  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const sentEmail = String(req.headers["x-user-email"] || "").toLowerCase();
  return Boolean(sentEmail && adminEmails.includes(sentEmail));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanOptionalString(value) {
  const next = String(value || "").trim();
  return next || undefined;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

module.exports = {
  readMarketplaceData,
  writeMarketplaceData,
  normalizeResource,
  publishedResources,
  isAdmin,
  sendJson,
  readBody
};
