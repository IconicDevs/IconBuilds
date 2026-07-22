const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const CONFIG = require("../config.js");

const DB_DEFAULT = {
  version: 1,
  users: [],
  resources: [],
  reviews: [],
  purchases: [],
  downloads: [],
  library: [],
  favorites: [],
  reports: [],
  auditLogs: [],
  verificationChallenges: [],
  passwordResets: []
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow"
};
const RATE_BUCKETS = new Map();

function now() {
  return new Date().toISOString();
}

function send(res, status, payload, headers = {}) {
  res.writeHead(status, { ...JSON_HEADERS, ...securityHeaders(), ...headers });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, { "Content-Type": contentType, ...securityHeaders(), ...headers });
  res.end(body);
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
}

function error(res, status, message) {
  send(res, status, { error: message });
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || CONFIG.site.domain;
  return `${proto}://${host}`;
}

function getUrl(req) {
  return new URL(req.url || "/", getOrigin(req));
}

function randomId(prefix = "") {
  return `${prefix}${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")}`;
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function secret() {
  return process.env.SESSION_SECRET || "iconbuilds-dev-session-secret-change-me";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function sessionToken(user) {
  const payload = base64url(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role || "user",
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || !String(token).includes(".")) return null;
  const [payload, sig] = String(token).split(".");
  if (!timingSafeEqual(sign(payload), sig)) return null;
  try {
    const parsed = JSON.parse(fromBase64url(payload));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function authToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.headers.cookie || "";
  const found = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("iconBuildsSession="));
  return found ? decodeURIComponent(found.split("=").slice(1).join("=")) : "";
}

function authCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `iconBuildsSession=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

function clearAuthCookie() {
  return "iconBuildsSession=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function allowedOrigins(req) {
  return new Set([
    CONFIG.site.url,
    "http://localhost:4177",
    `http://${req.headers.host || ""}`,
    `https://${req.headers.host || ""}`,
    ...String(process.env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean)
  ]);
}

function validateOrigin(req, action) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return;
  if (action === "stripeWebhook") return;
  const origin = req.headers.origin;
  if (!origin) return;
  if (!allowedOrigins(req).has(origin)) {
    const err = new Error("Request origin is not allowed.");
    err.status = 403;
    throw err;
  }
}

function rateLimit(req, action) {
  const windowMs = 60 * 1000;
  const sensitive = new Set(["login", "register", "resendVerification", "changeVerificationEmail", "verifyEmail", "createCheckout", "download"]);
  const limit = sensitive.has(action) ? 20 : 160;
  const key = `${hashIp(req)}:${action || "default"}`;
  const current = Date.now();
  const bucket = RATE_BUCKETS.get(key) || { count: 0, resetAt: current + windowMs };
  if (current > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = current + windowMs;
  }
  bucket.count += 1;
  RATE_BUCKETS.set(key, bucket);
  if (bucket.count > limit) {
    const err = new Error("Too many requests. Please wait a minute and try again.");
    err.status = 429;
    throw err;
  }
}

function adminEmails() {
  return new Set(String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean));
}

function isAdminEmail(email) {
  return adminEmails().has(String(email || "").toLowerCase());
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    role: user.role || "user",
    roles: user.roles || [],
    avatarUrl: user.avatarUrl || "",
    emailOptIn: Boolean(user.emailOptIn),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function publicResource(resource, admin = false) {
  if (!resource) return null;
  const copy = { ...resource };
  if (!admin) {
    delete copy.fileUrl;
    delete copy.internalNotes;
  }
  return copy;
}

function normalizeDb(input) {
  const db = { ...DB_DEFAULT, ...(input || {}) };
  for (const key of Object.keys(DB_DEFAULT)) {
    if (Array.isArray(DB_DEFAULT[key]) && !Array.isArray(db[key])) db[key] = [];
  }
  db.version = Number(db.version || 1);
  return db;
}

function recoveryPath() {
  return path.join(process.cwd(), "data", "iconbuilds-db.json");
}

function localPath() {
  return process.env.ICONBUILDS_DB_PATH || path.join(os.tmpdir(), "iconbuilds-db.json");
}

function localBackupPath() {
  return process.env.ICONBUILDS_DB_BACKUP_PATH || path.join(os.tmpdir(), "iconbuilds-db.backup.json");
}

function githubConfig() {
  const token = process.env.GITHUB_TOKEN || "";
  const repo = process.env.GITHUB_REPO || "";
  if (!token || !repo) return null;
  return {
    token,
    repo,
    branch: process.env.GITHUB_BRANCH || "main",
    dbPath: process.env.GITHUB_DB_PATH || "data/iconbuilds-db.json",
    backupPath: process.env.GITHUB_DB_BACKUP_PATH || "data/iconbuilds-db.backup.json"
  };
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJsonFile(filePath, db) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const next = JSON.stringify(normalizeDb(db), null, 2);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, next);
  await fs.rename(tmp, filePath);
}

async function githubFetch(url, options = {}) {
  const cfg = githubConfig();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!response.ok) {
    const err = new Error(json.message || "GitHub storage request failed.");
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function readGithubFile(filePath) {
  const cfg = githubConfig();
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(cfg.branch)}`;
  try {
    const json = await githubFetch(url);
    const content = Buffer.from(String(json.content || "").replace(/\s/g, ""), "base64").toString("utf8");
    return { db: normalizeDb(JSON.parse(content)), sha: json.sha || "" };
  } catch (err) {
    if (err.status !== 404) throw err;
    return { db: normalizeDb(await readJsonFile(recoveryPath()).catch(() => DB_DEFAULT)), sha: "" };
  }
}

async function writeGithubFile(filePath, db, sha, message) {
  const cfg = githubConfig();
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(normalizeDb(db), null, 2)).toString("base64"),
    branch: cfg.branch
  };
  if (sha) body.sha = sha;
  return githubFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readStore() {
  if (githubConfig()) {
    const primary = await readGithubFile(githubConfig().dbPath);
    return { ...primary, source: "github" };
  }
  try {
    return { db: normalizeDb(await readJsonFile(localPath())), sha: "", source: "local" };
  } catch {
    try {
      return { db: normalizeDb(await readJsonFile(recoveryPath())), sha: "", source: "recovery" };
    } catch {
      return { db: normalizeDb(DB_DEFAULT), sha: "", source: "empty" };
    }
  }
}

async function writeStore(db, sha, message) {
  if (githubConfig()) {
    const result = await writeGithubFile(githubConfig().dbPath, db, sha, message);
    try {
      await writeGithubFile(githubConfig().backupPath, db, "", `Backup ${message}`);
    } catch {
      await writeJsonFile(localBackupPath(), db).catch(() => {});
    }
    return result.content?.sha || result.sha || sha;
  }
  await writeJsonFile(localPath(), db);
  await writeJsonFile(localBackupPath(), db).catch(() => {});
  return "";
}

async function withDb(mutator, message = "IconBuilds data update") {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { db, sha } = await readStore();
    const before = JSON.stringify(db);
    const result = await mutator(db);
    if (JSON.stringify(db) === before && result) return { db: normalizeDb(db), result };
    try {
      const nextSha = await writeStore(normalizeDb(db), sha, message);
      return { db: normalizeDb(db), result, sha: nextSha };
    } catch (err) {
      lastError = err;
      if (![409, 422].includes(Number(err.status))) throw err;
    }
  }
  throw lastError || new Error("Storage changed before this action finished.");
}

async function readBody(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      const err = new Error("Request body is too large.");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function jsonBody(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    const err = new Error("Unreadable request body.");
    err.status = 400;
    throw err;
  }
}

async function currentUser(req, db) {
  const parsed = verifyToken(authToken(req));
  if (!parsed) return null;
  const user = db.users.find((item) => item.id === parsed.sub);
  if (!user || user.banned || user.suspended) return null;
  if (isAdminEmail(user.email) && user.role !== "admin") user.role = "admin";
  return user;
}

function requireUser(user) {
  if (!user) {
    const err = new Error("Log in to continue.");
    err.status = 401;
    throw err;
  }
  return user;
}

function requireVerified(user) {
  requireUser(user);
  if (!user.emailVerified) {
    const err = new Error("Verify your email before using account features.");
    err.status = 403;
    throw err;
  }
  return user;
}

function requireAdmin(user) {
  requireVerified(user);
  if (user.role !== "admin" && !(user.roles || []).includes("admin")) {
    const err = new Error("Admin access is required.");
    err.status = 403;
    throw err;
  }
  return user;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .toLowerCase() || randomId("resource-");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/[^\w.-]/g, "").slice(0, 32);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return timingSafeEqual(actual, expected);
}

function validatePassword(password) {
  if (String(password || "").length < 8) {
    const err = new Error("Password must be at least 8 characters.");
    err.status = 400;
    throw err;
  }
}

function safeUrl(value, optional = true) {
  const input = String(value || "").trim();
  if (!input) {
    if (optional) return "";
    const err = new Error("A URL is required.");
    err.status = 400;
    throw err;
  }
  try {
    const url = new URL(input);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("bad protocol");
    return url.toString();
  } catch {
    const err = new Error("Use a valid http or https URL.");
    err.status = 400;
    throw err;
  }
}

function moderateText(text, field = "content") {
  const value = String(text || "");
  const lower = value.toLowerCase();
  for (const word of CONFIG.moderation.blockedWords || []) {
    if (!word || word.includes("placeholder")) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(value)) {
      const err = new Error(`${field} contains blocked language.`);
      err.status = 400;
      throw err;
    }
  }
  for (const domain of CONFIG.moderation.blockedLinkDomains || []) {
    if (domain && lower.includes(domain.toLowerCase())) {
      const err = new Error(`${field} contains a blocked link.`);
      err.status = 400;
      throw err;
    }
  }
  return value;
}

function validateFileUrl(fileUrl) {
  const url = safeUrl(fileUrl);
  if (!url) return "";
  const lower = new URL(url).pathname.toLowerCase();
  for (const extension of CONFIG.moderation.suspiciousExtensions || []) {
    if (lower.endsWith(extension.toLowerCase())) {
      const err = new Error("That file type is not allowed.");
      err.status = 400;
      throw err;
    }
  }
  const allowed = CONFIG.resource.allowedFileExtensions || [];
  if (allowed.length && !allowed.some((extension) => lower.endsWith(extension.toLowerCase()))) {
    const err = new Error("That downloadable file extension is not allowed.");
    err.status = 400;
    throw err;
  }
  return url;
}

function parseArray(value, limit = 50) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

function parseObjectArray(value, limit = 30) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object").slice(0, limit) : [];
}

function sanitizeDependency(dep) {
  return {
    name: moderateText(String(dep.name || "").slice(0, 120), "Dependency name"),
    description: moderateText(String(dep.description || "").slice(0, 800), "Dependency description"),
    required: Boolean(dep.required),
    url: dep.url ? safeUrl(dep.url) : "",
    version: String(dep.version || "").slice(0, 80)
  };
}

function sanitizeUpdate(update) {
  return {
    version: String(update.version || "").slice(0, 60),
    title: moderateText(String(update.title || "Update").slice(0, 120), "Update title"),
    date: update.date || now().slice(0, 10),
    changelog: moderateText(String(update.changelog || "").slice(0, 10000), "Changelog"),
    fileLabel: String(update.fileLabel || "").slice(0, 120)
  };
}

function sanitizeResource(input, db) {
  const resource = input || {};
  const id = resource.id && db.resources.some((item) => item.id === resource.id) ? resource.id : randomId("res_");
  const existing = db.resources.find((item) => item.id === id) || {};
  const name = moderateText(String(resource.name || "").trim().slice(0, 120), "Resource name");
  if (!name) {
    const err = new Error("Resource name is required.");
    err.status = 400;
    throw err;
  }
  const category = String(resource.category || "").trim();
  if (!CONFIG.categories.some((item) => item.id === category)) {
    const err = new Error("Choose a valid category.");
    err.status = 400;
    throw err;
  }
  const slug = slugify(resource.slug || name);
  const slugTaken = db.resources.some((item) => item.id !== id && item.slug === slug);
  if (slugTaken) {
    const err = new Error("That resource URL slug is already used.");
    err.status = 409;
    throw err;
  }
  const free = resource.free === true || resource.free === "true";
  const priceCents = Math.max(0, Math.round(Number(resource.priceCents || 0)));
  if (!free && priceCents < 50) {
    const err = new Error("Paid resources need a valid price.");
    err.status = 400;
    throw err;
  }
  const status = resource.status === "published" ? "published" : "draft";
  const description = moderateText(String(resource.description || "").slice(0, 80000), "Description");
  const shortDescription = moderateText(String(resource.shortDescription || "").trim().slice(0, 220), "Short description");
  if (status === "published" && (!shortDescription || !description)) {
    const err = new Error("Published resources need a short and full description.");
    err.status = 400;
    throw err;
  }
  const showcaseImages = parseArray(resource.showcaseImages, CONFIG.resource.showcaseImageLimit).map((url) => safeUrl(url));
  const next = {
    ...existing,
    id,
    name,
    slug,
    shortDescription,
    description,
    category,
    tags: parseArray(resource.tags, 30).map((item) => moderateText(item, "Tag")),
    free,
    priceCents: free ? 0 : priceCents,
    currency: CONFIG.stripe.currency || "usd",
    ownershipLabel: CONFIG.resource.ownershipLabels.includes(resource.ownershipLabel) ? resource.ownershipLabel : CONFIG.resource.ownershipLabels[0],
    coverImage: resource.coverImage ? safeUrl(resource.coverImage) : "",
    showcaseImages,
    youtubeUrl: resource.youtubeUrl ? safeUrl(resource.youtubeUrl) : "",
    fileUrl: resource.fileUrl ? validateFileUrl(resource.fileUrl) : "",
    currentVersion: String(resource.currentVersion || existing.currentVersion || "1.0.0").slice(0, 60),
    dependencies: parseObjectArray(resource.dependencies, 30).map(sanitizeDependency),
    updates: parseObjectArray(resource.updates, 50).map(sanitizeUpdate),
    minecraftVersions: parseArray(resource.minecraftVersions, 30),
    serverSoftware: parseArray(resource.serverSoftware, 30),
    compatibility: parseArray(resource.compatibility, 30),
    installation: moderateText(String(resource.installation || "").slice(0, 20000), "Installation"),
    supportInfo: moderateText(String(resource.supportInfo || "").slice(0, 12000), "Support info"),
    notices: moderateText(String(resource.notices || "").slice(0, 12000), "Notices"),
    featured: Boolean(resource.featured),
    status,
    seoTitle: String(resource.seoTitle || "").slice(0, 70),
    seoDescription: String(resource.seoDescription || "").slice(0, 170),
    canonicalUrl: `${CONFIG.site.url}/resources/${slug}/`,
    imageAlt: String(resource.imageAlt || `${name} resource preview`).slice(0, 180),
    updatedAt: now(),
    createdAt: existing.createdAt || now(),
    publishedAt: status === "published" ? (existing.publishedAt || now()) : existing.publishedAt || "",
    averageRating: Number(existing.averageRating || 0),
    reviewCount: Number(existing.reviewCount || 0),
    downloadCount: Number(existing.downloadCount || 0),
    purchaseCount: Number(existing.purchaseCount || 0)
  };
  return next;
}

function recomputeResourceStats(db) {
  for (const resource of db.resources) {
    const reviews = db.reviews.filter((item) => item.resourceId === resource.id && !item.hidden);
    resource.reviewCount = reviews.length;
    resource.averageRating = reviews.length ? Number((reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(2)) : 0;
    resource.purchaseCount = db.purchases.filter((item) => item.resourceId === resource.id && item.status === "paid").length;
    resource.downloadCount = db.downloads.filter((item) => item.resourceId === resource.id).length;
  }
}

function hasAccess(db, userId, resourceId) {
  return db.library.some((item) => item.userId === userId && item.resourceId === resourceId);
}

function addLibrary(db, userId, resourceId, source) {
  if (!hasAccess(db, userId, resourceId)) {
    db.library.push({ id: randomId("lib_"), userId, resourceId, source, createdAt: now() });
  }
}

function stateFor(db, user, options = {}) {
  recomputeResourceStats(db);
  const admin = user && (user.role === "admin" || (user.roles || []).includes("admin"));
  const resources = db.resources
    .filter((item) => admin || item.status === "published")
    .map((item) => publicResource(item, admin));
  const publicReviews = db.reviews.filter((item) => admin || (!item.hidden && db.resources.some((res) => res.id === item.resourceId && res.status === "published")));
  return {
    ok: true,
    generatedAt: now(),
    user: publicUser(user),
    resources,
    reviews: publicReviews,
    purchases: user ? db.purchases.filter((item) => admin || item.userId === user.id) : [],
    downloads: user ? db.downloads.filter((item) => admin || item.userId === user.id) : [],
    library: user ? db.library.filter((item) => admin || item.userId === user.id) : [],
    favorites: user ? db.favorites.filter((item) => item.userId === user.id) : [],
    users: admin ? db.users.map(publicUser) : [],
    stats: admin ? adminStats(db) : publicStats(db),
    resourceSlug: options.resourceSlug || ""
  };
}

function adminStats(db) {
  return {
    totalUsers: db.users.length,
    verifiedUsers: db.users.filter((item) => item.emailVerified).length,
    totalResources: db.resources.length,
    draftResources: db.resources.filter((item) => item.status !== "published").length,
    publishedResources: db.resources.filter((item) => item.status === "published").length,
    freeResources: db.resources.filter((item) => item.status === "published" && item.free).length,
    paidResources: db.resources.filter((item) => item.status === "published" && !item.free).length,
    totalPurchases: db.purchases.filter((item) => item.status === "paid").length,
    revenueCents: db.purchases.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amountCents || 0), 0),
    totalDownloads: db.downloads.length,
    pendingReviews: db.reviews.filter((item) => item.pending).length,
    reportedReviews: db.reports.filter((item) => item.type === "review" && !item.closed).length,
    recentRegistrations: db.users.slice(-8).map(publicUser),
    recentPurchases: db.purchases.slice(-8),
    recentDownloads: db.downloads.slice(-8),
    recentModerationActions: db.auditLogs.slice(-12)
  };
}

function publicStats(db) {
  return {
    publishedResources: db.resources.filter((item) => item.status === "published").length,
    freeResources: db.resources.filter((item) => item.status === "published" && item.free).length,
    paidResources: db.resources.filter((item) => item.status === "published" && !item.free).length
  };
}

async function sendVerificationEmail(user, code) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return { skipped: true };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: user.email,
      subject: "Verify your IconBuilds account",
      html: `<p>Your IconBuilds verification code is:</p><h1>${code}</h1><p>This code expires in 30 minutes.</p>`,
      text: `Your IconBuilds verification code is ${code}. This code expires in 30 minutes.`
    })
  });
  if (!response.ok) {
    const err = new Error("Verification email could not be sent.");
    err.status = 502;
    throw err;
  }
  return response.json().catch(() => ({}));
}

async function createVerification(db, user) {
  const code = String(crypto.randomInt(100000, 999999));
  const challenge = {
    id: randomId("ver_"),
    userId: user.id,
    email: user.email,
    codeHash: hashPassword(code),
    createdAt: now(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    lastSentAt: now(),
    usedAt: ""
  };
  db.verificationChallenges = db.verificationChallenges.filter((item) => item.userId !== user.id || item.usedAt);
  db.verificationChallenges.push(challenge);
  await sendVerificationEmail(user, code);
  if (process.env.NODE_ENV !== "production") challenge.devCode = code;
  return challenge;
}

async function handleRegister(req, res, body) {
  if (!CONFIG.registration.enabled) return error(res, 403, "Registration is closed.");
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  if (!username || username.length < 3) return error(res, 400, "Choose a username with at least 3 characters.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error(res, 400, "Use a valid email address.");
  if (!body.termsAccepted) return error(res, 400, "Accept the terms before creating an account.");
  validatePassword(body.password);
  const result = await withDb(async (db) => {
    if (db.users.some((item) => item.email.toLowerCase() === email)) {
      const err = new Error("That email is already registered.");
      err.status = 409;
      throw err;
    }
    if (db.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
      const err = new Error("That username is already registered.");
      err.status = 409;
      throw err;
    }
    const user = {
      id: randomId("usr_"),
      username,
      email,
      passwordHash: hashPassword(body.password),
      role: isAdminEmail(email) ? "admin" : "user",
      roles: isAdminEmail(email) ? ["admin"] : [],
      emailVerified: false,
      emailOptIn: Boolean(body.emailOptIn),
      googleId: "",
      avatarUrl: "",
      createdAt: now(),
      updatedAt: now()
    };
    db.users.push(user);
    await createVerification(db, user);
    db.auditLogs.push({ id: randomId("audit_"), type: "register", userId: user.id, createdAt: now() });
    const token = sessionToken(user);
    return { token, user: publicUser(user), message: "Verification email sent." };
  }, `Register IconBuilds user ${email}`);
  send(res, 200, result.result, { "Set-Cookie": authCookie(result.result.token) });
}

async function handleLogin(req, res, body) {
  const login = String(body.login || "").trim().toLowerCase();
  const password = String(body.password || "");
  const { db } = await readStore();
  const user = db.users.find((item) => item.email.toLowerCase() === login || item.username.toLowerCase() === login);
  if (!user || !verifyPassword(password, user.passwordHash)) return error(res, 401, "That login did not match an account.");
  if (user.banned || user.suspended) return error(res, 403, "This account cannot sign in.");
  if (isAdminEmail(user.email)) {
    user.role = "admin";
    if (!user.roles.includes("admin")) user.roles.push("admin");
  }
  const token = sessionToken(user);
  send(res, 200, { token, user: publicUser(user) }, { "Set-Cookie": authCookie(token) });
}

async function handleVerify(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireUser(await currentUser(req, db));
    const code = String(body.code || "").trim();
    const challenge = [...db.verificationChallenges].reverse().find((item) => item.userId === user.id && !item.usedAt);
    if (!challenge || new Date(challenge.expiresAt).getTime() < Date.now()) {
      const err = new Error("Verification session expired. Log in or sign up again.");
      err.status = 400;
      throw err;
    }
    if (!verifyPassword(code, challenge.codeHash)) {
      const err = new Error("That verification code is not correct.");
      err.status = 400;
      throw err;
    }
    challenge.usedAt = now();
    user.emailVerified = true;
    user.updatedAt = now();
    db.auditLogs.push({ id: randomId("audit_"), type: "verify-email", userId: user.id, createdAt: now() });
    const token = sessionToken(user);
    return { token, user: publicUser(user), message: "Email verified." };
  }, "Verify IconBuilds email");
  send(res, 200, result.result, { "Set-Cookie": authCookie(result.result.token) });
}

async function handleResendVerification(req, res) {
  const result = await withDb(async (db) => {
    const user = requireUser(await currentUser(req, db));
    if (user.emailVerified) return { user: publicUser(user), message: "Email is already verified." };
    const latest = [...db.verificationChallenges].reverse().find((item) => item.userId === user.id && !item.usedAt);
    if (latest && Date.now() - new Date(latest.lastSentAt || latest.createdAt).getTime() < 60000) {
      const err = new Error("Wait a minute before resending another code.");
      err.status = 429;
      throw err;
    }
    await createVerification(db, user);
    return { user: publicUser(user), message: "Verification email sent." };
  }, "Resend IconBuilds verification email");
  send(res, 200, result.result);
}

async function handleChangeEmail(req, res, body) {
  const email = normalizeEmail(body.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error(res, 400, "Use a valid email address.");
  const result = await withDb(async (db) => {
    const user = requireUser(await currentUser(req, db));
    if (db.users.some((item) => item.id !== user.id && item.email.toLowerCase() === email)) {
      const err = new Error("That email is already registered.");
      err.status = 409;
      throw err;
    }
    user.email = email;
    user.emailVerified = false;
    user.role = isAdminEmail(email) ? "admin" : "user";
    user.roles = isAdminEmail(email) ? Array.from(new Set([...(user.roles || []), "admin"])) : (user.roles || []).filter((role) => role !== "admin");
    user.updatedAt = now();
    await createVerification(db, user);
    const token = sessionToken(user);
    return { token, user: publicUser(user), message: "Email changed. Verification email sent." };
  }, "Change IconBuilds verification email");
  send(res, 200, result.result, { "Set-Cookie": authCookie(result.result.token) });
}

function googleState(next) {
  const payload = base64url(JSON.stringify({ next: next || "/", nonce: randomId("oauth_"), exp: Date.now() + 1000 * 60 * 10 }));
  return `${payload}.${sign(payload)}`;
}

function verifyGoogleState(value) {
  const parsed = verifyTokenLike(value);
  if (!parsed || parsed.exp < Date.now()) return "/";
  return parsed.next || "/";
}

function verifyTokenLike(value) {
  if (!value || !String(value).includes(".")) return null;
  const [payload, sig] = String(value).split(".");
  if (!timingSafeEqual(sign(payload), sig)) return null;
  try {
    return JSON.parse(fromBase64url(payload));
  } catch {
    return null;
  }
}

function handleGoogleStart(req, res, url) {
  if (!process.env.GOOGLE_CLIENT_ID) return error(res, 503, "Google login is not configured.");
  const redirectUri = `${CONFIG.site.url}/api?action=googleCallback`;
  const next = url.searchParams.get("next") || "/";
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  target.searchParams.set("redirect_uri", redirectUri);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", "openid email profile");
  target.searchParams.set("state", googleState(next));
  target.searchParams.set("prompt", "select_account");
  res.writeHead(302, { Location: target.toString(), ...securityHeaders() });
  res.end();
}

async function handleGoogleCallback(req, res, url) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return error(res, 503, "Google login is not configured.");
  const code = url.searchParams.get("code");
  if (!code) return error(res, 400, "Google did not return a code.");
  const next = verifyGoogleState(url.searchParams.get("state"));
  const redirectUri = `${CONFIG.site.url}/api?action=googleCallback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const tokenJson = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenJson.access_token) return error(res, 400, "Google login could not be completed.");
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || !profile.email) return error(res, 400, "Google account email could not be read.");
  const result = await withDb(async (db) => {
    const email = normalizeEmail(profile.email);
    let user = db.users.find((item) => item.email.toLowerCase() === email || item.googleId === profile.sub);
    if (!user) {
      let username = normalizeUsername(profile.name || email.split("@")[0] || "IconBuildsUser");
      if (!username) username = "IconBuildsUser";
      let candidate = username;
      let count = 2;
      while (db.users.some((item) => item.username.toLowerCase() === candidate.toLowerCase())) {
        candidate = `${username}${count}`;
        count += 1;
      }
      user = {
        id: randomId("usr_"),
        username: candidate,
        email,
        passwordHash: "",
        role: isAdminEmail(email) ? "admin" : "user",
        roles: isAdminEmail(email) ? ["admin"] : [],
        emailVerified: Boolean(profile.email_verified),
        emailOptIn: false,
        googleId: profile.sub || "",
        avatarUrl: profile.picture || "",
        createdAt: now(),
        updatedAt: now()
      };
      db.users.push(user);
    } else {
      user.googleId = profile.sub || user.googleId || "";
      user.avatarUrl = profile.picture || user.avatarUrl || "";
      user.emailVerified = Boolean(profile.email_verified) || user.emailVerified;
      if (isAdminEmail(user.email)) {
        user.role = "admin";
        user.roles = Array.from(new Set([...(user.roles || []), "admin"]));
      }
      user.updatedAt = now();
    }
    const session = { token: sessionToken(user), user: publicUser(user) };
    db.auditLogs.push({ id: randomId("audit_"), type: "google-login", userId: user.id, createdAt: now() });
    return session;
  }, "Google IconBuilds login");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account/";
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in...</title><script>localStorage.setItem("iconBuildsSession", ${JSON.stringify(JSON.stringify(result.result))}); location.replace(${JSON.stringify(safeNext)});</script><p>Signing in...</p>`;
  sendText(res, 200, html, "text/html; charset=utf-8", { "Set-Cookie": authCookie(result.result.token) });
}

async function handleAdmin(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireAdmin(await currentUser(req, db));
    if (body.command === "saveResource") {
      const resource = sanitizeResource(body.resource || {}, db);
      const index = db.resources.findIndex((item) => item.id === resource.id);
      if (index >= 0) db.resources[index] = resource;
      else db.resources.push(resource);
      db.auditLogs.push({ id: randomId("audit_"), type: "save-resource", userId: user.id, resourceId: resource.id, createdAt: now() });
    } else if (body.command === "togglePublishResource") {
      const resource = db.resources.find((item) => item.id === body.id);
      if (!resource) throw Object.assign(new Error("Resource not found."), { status: 404 });
      resource.status = resource.status === "published" ? "draft" : "published";
      resource.updatedAt = now();
      if (resource.status === "published" && !resource.publishedAt) resource.publishedAt = now();
      db.auditLogs.push({ id: randomId("audit_"), type: "toggle-resource", userId: user.id, resourceId: resource.id, createdAt: now() });
    } else if (body.command === "deleteResource") {
      const resource = db.resources.find((item) => item.id === body.id);
      if (!resource) throw Object.assign(new Error("Resource not found."), { status: 404 });
      db.resources = db.resources.filter((item) => item.id !== resource.id);
      db.reviews = db.reviews.filter((item) => item.resourceId !== resource.id);
      db.purchases = db.purchases.filter((item) => item.resourceId !== resource.id);
      db.downloads = db.downloads.filter((item) => item.resourceId !== resource.id);
      db.library = db.library.filter((item) => item.resourceId !== resource.id);
      db.favorites = db.favorites.filter((item) => item.resourceId !== resource.id);
      db.auditLogs.push({ id: randomId("audit_"), type: "delete-resource", userId: user.id, resourceId: resource.id, createdAt: now() });
    } else if (body.command === "toggleReview") {
      const review = db.reviews.find((item) => item.id === body.id);
      if (!review) throw Object.assign(new Error("Review not found."), { status: 404 });
      review.hidden = !review.hidden;
      review.updatedAt = now();
      db.auditLogs.push({ id: randomId("audit_"), type: "moderate-review", userId: user.id, reviewId: review.id, createdAt: now() });
    } else {
      throw Object.assign(new Error("Unknown admin command."), { status: 400 });
    }
    recomputeResourceStats(db);
    return stateFor(db, user);
  }, `IconBuilds admin ${body.command || "action"}`);
  send(res, 200, result.result);
}

async function handleCreateCheckout(req, res, body) {
  const { db } = await readStore();
  const user = requireVerified(await currentUser(req, db));
  const resource = db.resources.find((item) => item.id === body.resourceId && item.status === "published");
  if (!resource) return error(res, 404, "Resource not found.");
  if (resource.free || Number(resource.priceCents || 0) <= 0) return error(res, 400, "This resource is free.");
  if (hasAccess(db, user.id, resource.id)) return send(res, 200, { url: `${CONFIG.site.url}/account/`, message: "Already in your library." });
  if (!process.env.STRIPE_SECRET_KEY) return error(res, 503, "Stripe is not configured yet.");
  const session = await stripeRequest("/v1/checkout/sessions", {
    mode: "payment",
    success_url: `${CONFIG.site.url}${CONFIG.stripe.successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${CONFIG.site.url}/resources/${resource.slug}/`,
    client_reference_id: `${user.id}:${resource.id}`,
    customer_email: user.email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": CONFIG.stripe.currency || "usd",
    "line_items[0][price_data][unit_amount]": String(resource.priceCents),
    "line_items[0][price_data][product_data][name]": resource.name,
    "line_items[0][price_data][product_data][description]": resource.shortDescription || "IconBuilds resource",
    "metadata[userId]": user.id,
    "metadata[resourceId]": resource.id,
    allow_promotion_codes: "true"
  });
  send(res, 200, { url: session.url, id: session.id });
}

async function stripeRequest(pathname, fields, method = "POST") {
  const response = await fetch(`https://api.stripe.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(fields)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(json.error?.message || "Stripe request failed.");
    err.status = response.status;
    throw err;
  }
  return json;
}

async function handleCheckoutSuccess(req, res, body) {
  if (!process.env.STRIPE_SECRET_KEY) return error(res, 503, "Stripe is not configured yet.");
  const sessionId = String(body.sessionId || "");
  if (!sessionId.startsWith("cs_")) return error(res, 400, "Invalid Stripe session.");
  const session = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {}, "GET");
  const result = await grantStripePurchase(session);
  send(res, 200, result);
}

async function grantStripePurchase(session) {
  if (!session || session.payment_status !== "paid") {
    const err = new Error("Stripe has not confirmed payment.");
    err.status = 402;
    throw err;
  }
  const resourceId = session.metadata?.resourceId;
  const userId = session.metadata?.userId;
  return (await withDb(async (db) => {
    const user = db.users.find((item) => item.id === userId);
    const resource = db.resources.find((item) => item.id === resourceId && item.status === "published");
    if (!user || !resource) throw Object.assign(new Error("Purchase target was not found."), { status: 404 });
    const existing = db.purchases.find((item) => item.stripeSessionId === session.id);
    if (!existing) {
      db.purchases.push({
        id: randomId("pur_"),
        userId,
        resourceId,
        stripeSessionId: session.id,
        amountCents: Number(session.amount_total || resource.priceCents || 0),
        currency: session.currency || CONFIG.stripe.currency || "usd",
        status: "paid",
        createdAt: now()
      });
      addLibrary(db, userId, resourceId, "purchase");
      db.auditLogs.push({ id: randomId("audit_"), type: "purchase", userId, resourceId, createdAt: now() });
    }
    recomputeResourceStats(db);
    return { ok: true, message: "Purchase confirmed and added to your library." };
  }, "Grant IconBuilds purchase")).result;
}

async function handleStripeWebhook(req, res, raw) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return error(res, 503, "Stripe webhook secret is not configured.");
  const signature = req.headers["stripe-signature"] || "";
  const event = verifyStripeEvent(raw, signature);
  if (event.type === "checkout.session.completed") await grantStripePurchase(event.data.object);
  send(res, 200, { received: true });
}

function verifyStripeEvent(raw, signatureHeader) {
  const parts = Object.fromEntries(String(signatureHeader).split(",").map((part) => part.split("=").map((item) => item.trim())));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) throw Object.assign(new Error("Invalid Stripe signature."), { status: 400 });
  const signed = `${timestamp}.${raw.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(signed).digest("hex");
  if (!timingSafeEqual(expected, signature)) throw Object.assign(new Error("Invalid Stripe signature."), { status: 400 });
  return JSON.parse(raw.toString("utf8"));
}

async function handleAddFree(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireVerified(await currentUser(req, db));
    if (!body.acceptedTerms) throw Object.assign(new Error("Accept the resource terms before adding it."), { status: 400 });
    const resource = db.resources.find((item) => item.id === body.resourceId && item.status === "published");
    if (!resource) throw Object.assign(new Error("Resource not found."), { status: 404 });
    if (!resource.free && Number(resource.priceCents || 0) > 0) throw Object.assign(new Error("This resource must be purchased."), { status: 402 });
    addLibrary(db, user.id, resource.id, "free");
    db.auditLogs.push({ id: randomId("audit_"), type: "add-free-resource", userId: user.id, resourceId: resource.id, createdAt: now() });
    return { ok: true, message: "Resource added to your library." };
  }, "Add free IconBuilds resource");
  send(res, 200, result.result);
}

async function handleDownload(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireVerified(await currentUser(req, db));
    const resource = db.resources.find((item) => item.id === body.resourceId && item.status === "published");
    if (!resource) throw Object.assign(new Error("Resource not found."), { status: 404 });
    if (!hasAccess(db, user.id, resource.id)) throw Object.assign(new Error("Add or purchase this resource before downloading."), { status: 403 });
    if (!resource.fileUrl) return { ok: true, message: "Download file has not been attached yet." };
    db.downloads.push({ id: randomId("down_"), userId: user.id, resourceId: resource.id, ipHash: hashIp(req), createdAt: now() });
    recomputeResourceStats(db);
    return { ok: true, downloadUrl: `${CONFIG.site.url}/api?action=downloadFile&token=${downloadToken(user.id, resource.id)}` };
  }, "Record IconBuilds download");
  send(res, 200, result.result);
}

function downloadToken(userId, resourceId) {
  const payload = base64url(JSON.stringify({ userId, resourceId, exp: Date.now() + 1000 * 60 * 5 }));
  return `${payload}.${sign(payload)}`;
}

async function handleDownloadFile(req, res, url) {
  const parsed = verifyTokenLike(url.searchParams.get("token"));
  if (!parsed || parsed.exp < Date.now()) return error(res, 403, "Download link expired.");
  const { db } = await readStore();
  const resource = db.resources.find((item) => item.id === parsed.resourceId && item.status === "published");
  if (!resource || !resource.fileUrl) return error(res, 404, "Download file was not found.");
  if (!hasAccess(db, parsed.userId, resource.id)) return error(res, 403, "Download access is required.");
  res.writeHead(302, { Location: resource.fileUrl, ...securityHeaders(), "Cache-Control": "no-store" });
  res.end();
}

async function handleFavorite(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireVerified(await currentUser(req, db));
    const resource = db.resources.find((item) => item.id === body.resourceId && item.status === "published");
    if (!resource) throw Object.assign(new Error("Resource not found."), { status: 404 });
    const existing = db.favorites.find((item) => item.userId === user.id && item.resourceId === resource.id);
    if (existing) {
      db.favorites = db.favorites.filter((item) => item.id !== existing.id);
      return { favorited: false };
    }
    db.favorites.push({ id: randomId("fav_"), userId: user.id, resourceId: resource.id, createdAt: now() });
    return { favorited: true };
  }, "Toggle IconBuilds favorite");
  send(res, 200, result.result);
}

async function handleSaveReview(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireVerified(await currentUser(req, db));
    const resource = db.resources.find((item) => item.id === body.resourceId && item.status === "published");
    if (!resource) throw Object.assign(new Error("Resource not found."), { status: 404 });
    if (CONFIG.reviews.requireOwnership && !hasAccess(db, user.id, resource.id)) {
      throw Object.assign(new Error("You need this resource in your library before reviewing it."), { status: 403 });
    }
    const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
    const title = moderateText(String(body.title || "").slice(0, 120), "Review title");
    const comment = moderateText(String(body.comment || "").slice(0, 4000), "Review comment");
    if (!title || !comment) throw Object.assign(new Error("Review title and comment are required."), { status: 400 });
    let review = db.reviews.find((item) => item.userId === user.id && item.resourceId === resource.id);
    if (!review) {
      review = { id: randomId("rev_"), userId: user.id, username: user.username, resourceId: resource.id, createdAt: now() };
      db.reviews.push(review);
    } else {
      review.editedAt = now();
    }
    review.rating = rating;
    review.title = title;
    review.comment = comment;
    review.verifiedPurchase = hasAccess(db, user.id, resource.id);
    review.hidden = CONFIG.reviews.moderationRequired;
    review.pending = CONFIG.reviews.moderationRequired;
    review.updatedAt = now();
    recomputeResourceStats(db);
    return { ok: true, review };
  }, "Save IconBuilds review");
  send(res, 200, result.result);
}

async function handleReportReview(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireVerified(await currentUser(req, db));
    const review = db.reviews.find((item) => item.id === body.reviewId);
    if (!review) throw Object.assign(new Error("Review not found."), { status: 404 });
    db.reports.push({ id: randomId("rep_"), type: "review", reviewId: review.id, userId: user.id, reason: moderateText(String(body.reason || "Reported from resource page").slice(0, 1000), "Report reason"), closed: false, createdAt: now() });
    return { ok: true, message: "Review reported." };
  }, "Report IconBuilds review");
  send(res, 200, result.result);
}

async function handleDeleteReview(req, res, body) {
  const result = await withDb(async (db) => {
    const user = requireVerified(await currentUser(req, db));
    const review = db.reviews.find((item) => item.id === body.reviewId);
    if (!review) throw Object.assign(new Error("Review not found."), { status: 404 });
    const admin = user.role === "admin" || (user.roles || []).includes("admin");
    if (!admin && review.userId !== user.id) throw Object.assign(new Error("You can only delete your own review."), { status: 403 });
    db.reviews = db.reviews.filter((item) => item.id !== review.id);
    db.auditLogs.push({ id: randomId("audit_"), type: "delete-review", userId: user.id, reviewId: review.id, createdAt: now() });
    recomputeResourceStats(db);
    return { ok: true };
  }, "Delete IconBuilds review");
  send(res, 200, result.result);
}

function hashIp(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  return crypto.createHash("sha256").update(`${ip}:${secret()}`).digest("hex").slice(0, 32);
}

async function handleState(req, res, bodyOrQuery) {
  const { db } = await readStore();
  const user = await currentUser(req, db);
  send(res, 200, stateFor(db, user, bodyOrQuery || {}));
}

function xmlEscape(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sitemapXml(db) {
  const urls = [
    ["", "daily", "1.0"],
    ["resources/", "daily", "0.9"],
    ["free/", "daily", "0.8"],
    ["premium/", "daily", "0.8"],
    ["terms/", "monthly", "0.3"],
    ["privacy/", "monthly", "0.3"],
    ["refund/", "monthly", "0.3"],
    ["guidelines/", "monthly", "0.3"],
    ["support/", "monthly", "0.4"],
    ...CONFIG.categories.map((cat) => [`resources/${cat.id}/`, "weekly", "0.7"]),
    ...db.resources.filter((item) => item.status === "published").map((item) => [`resources/${item.slug}/`, "weekly", "0.8", item.updatedAt])
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([loc, changefreq, priority, lastmod]) => `  <url>\n    <loc>${xmlEscape(`${CONFIG.site.url}/${loc}`)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${lastmod ? `\n    <lastmod>${xmlEscape(new Date(lastmod).toISOString())}</lastmod>` : ""}\n  </url>`).join("\n")}\n</urlset>\n`;
}

async function handleSitemap(req, res) {
  const { db } = await readStore();
  sendText(res, 200, sitemapXml(db), "application/xml; charset=utf-8", { "Cache-Control": "public, max-age=600" });
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function htmlEscape(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function categoryPageHtml(category) {
  const title = `${category.name} Minecraft Resources | IconBuilds`;
  const description = `Browse official IconRealms ${category.name.toLowerCase()} for Minecraft and Discord communities on IconBuilds.`;
  return pageShell("resources", title, description, `${CONFIG.site.url}/resources/${category.id}/`, `
    <section class="section">
      <nav class="muted"><a href="/resources/">Resources</a> / ${htmlEscape(category.name)}</nav>
      <h1 class="section-title">${htmlEscape(category.name)} Resources</h1>
      <p class="section-copy">${htmlEscape(category.description)}</p>
      <div id="category-seo-copy" class="panel">
        <p>IconBuilds publishes official IconRealms resources only. This category page is reserved for admin-published ${htmlEscape(category.name.toLowerCase())} resources.</p>
      </div>
    </section>`);
}

function resourcePageHtml(resource) {
  const title = resource.seoTitle || `${resource.name} | IconBuilds Resource`;
  const description = (resource.seoDescription || resource.shortDescription || stripHtml(resource.description) || CONFIG.seo.description).slice(0, 160);
  const canonical = `${CONFIG.site.url}/resources/${resource.slug}/`;
  const schema = structuredData(resource);
  const images = [resource.coverImage, ...(resource.showcaseImages || [])].filter(Boolean);
  return pageShell("resource", title, description, canonical, `
    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
    <section class="section">
      <nav class="muted"><a href="/resources/">Resources</a> / ${htmlEscape(categoryByIdServer(resource.category).name)} / ${htmlEscape(resource.name)}</nav>
      <div class="resource-layout">
        <article>
          <p class="eyebrow">${htmlEscape(categoryByIdServer(resource.category).name)}</p>
          <h1 class="resource-title">${htmlEscape(resource.name)}</h1>
          <p class="section-copy">${htmlEscape(resource.shortDescription || "")}</p>
          ${images[0] ? `<div class="gallery-main"><img src="${htmlEscape(images[0])}" alt="${htmlEscape(resource.imageAlt || resource.name)}"></div>` : ""}
          <div class="panel rich-text">${htmlEscape(stripHtml(resource.description || "")).replace(/\n/g, "<br>")}</div>
        </article>
        <aside class="purchase-box"><div class="panel"><div class="price-line"><span>${resource.free ? "Free download" : "License"}</span><strong>${htmlEscape(resource.free ? "Free" : `$${(Number(resource.priceCents || 0) / 100).toFixed(2)}`)}</strong></div><p class="muted">Published by ${htmlEscape(resource.ownershipLabel || "IconRealms")}.</p></div></aside>
      </div>
    </section>`);
}

function pageShell(page, title, description, canonical, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <meta name="description" content="${htmlEscape(description)}">
  <meta name="robots" content="${CONFIG.seo.robotsIndex}">
  <link rel="canonical" href="${htmlEscape(canonical)}">
  <meta property="og:title" content="${htmlEscape(title)}">
  <meta property="og:description" content="${htmlEscape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${htmlEscape(canonical)}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/config.js" defer></script>
  <script src="/assets/js/app.js" defer></script>
</head>
<body data-page="${page}">${body}</body>
</html>`;
}

function categoryByIdServer(id) {
  return CONFIG.categories.find((item) => item.id === id) || { id, name: id || "Resources", description: "" };
}

function structuredData(resource) {
  const data = {
    "@context": "https://schema.org",
    "@type": resource.category === "plugins" || resource.category === "skripts" ? "SoftwareApplication" : "Product",
    name: resource.name,
    description: resource.shortDescription || stripHtml(resource.description),
    image: [resource.coverImage, ...(resource.showcaseImages || [])].filter(Boolean),
    brand: { "@type": "Brand", name: CONFIG.site.owner },
    publisher: { "@type": "Organization", name: CONFIG.site.owner, url: CONFIG.site.url },
    category: categoryByIdServer(resource.category).name,
    offers: {
      "@type": "Offer",
      price: resource.free ? "0" : String((Number(resource.priceCents || 0) / 100).toFixed(2)),
      priceCurrency: (CONFIG.resource.currency || "USD").toUpperCase(),
      availability: "https://schema.org/InStock",
      url: `${CONFIG.site.url}/resources/${resource.slug}/`
    },
    softwareVersion: resource.currentVersion || "1.0.0",
    dateModified: resource.updatedAt || resource.createdAt
  };
  if (resource.reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(resource.averageRating),
      reviewCount: String(resource.reviewCount)
    };
  }
  return data;
}

async function handleResourcePage(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[0] === "resources" ? parts[1] : url.searchParams.get("slug");
  const category = CONFIG.categories.find((item) => item.id === slug);
  if (category) return sendText(res, 200, categoryPageHtml(category), "text/html; charset=utf-8", { "Cache-Control": "public, max-age=120" });
  const { db } = await readStore();
  recomputeResourceStats(db);
  const resource = db.resources.find((item) => item.status === "published" && (item.slug === slug || item.id === slug));
  if (!resource) return sendText(res, 404, pageShell("not-found", "Resource Not Found | IconBuilds", "That IconBuilds resource could not be found.", `${CONFIG.site.url}/resources/`, `<div class="notice">That resource could not be found.</div>`), "text/html; charset=utf-8");
  sendText(res, 200, resourcePageHtml(resource), "text/html; charset=utf-8", { "Cache-Control": "public, max-age=120" });
}

async function handler(req, res) {
  try {
    const url = getUrl(req);
    const action = url.searchParams.get("action")
      || (url.pathname.includes("sitemap.xml") ? "sitemap" : "")
      || (url.pathname.includes("/resources/") ? "resourcePage" : "");
    if (req.method === "OPTIONS") return sendText(res, 204, "");
    validateOrigin(req, action);
    rateLimit(req, action);
    if (action === "health") return send(res, 200, { ok: true, site: CONFIG.site.name, time: now() });
    if (action === "sitemap") return await handleSitemap(req, res);
    if (action === "resourcePage") return await handleResourcePage(req, res, url);
    if (action === "googleStart") return handleGoogleStart(req, res, url);
    if (action === "googleCallback") return await handleGoogleCallback(req, res, url);
    if (action === "downloadFile") return await handleDownloadFile(req, res, url);
    if (req.method === "GET") return await handleState(req, res, Object.fromEntries(url.searchParams.entries()));
    const raw = await readBody(req);
    if (action === "stripeWebhook" || url.pathname.includes("stripe-webhook")) return await handleStripeWebhook(req, res, raw);
    let body = {};
    try {
      body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      return error(res, 400, "Unreadable request body.");
    }
    if (action === "state") return await handleState(req, res, body);
    if (action === "register") return await handleRegister(req, res, body);
    if (action === "login") return await handleLogin(req, res, body);
    if (action === "verifyEmail") return await handleVerify(req, res, body);
    if (action === "resendVerification") return await handleResendVerification(req, res, body);
    if (action === "changeVerificationEmail") return await handleChangeEmail(req, res, body);
    if (action === "admin") return await handleAdmin(req, res, body);
    if (action === "createCheckout") return await handleCreateCheckout(req, res, body);
    if (action === "checkoutSuccess") return await handleCheckoutSuccess(req, res, body);
    if (action === "addFreeResource") return await handleAddFree(req, res, body);
    if (action === "download") return await handleDownload(req, res, body);
    if (action === "favorite") return await handleFavorite(req, res, body);
    if (action === "saveReview") return await handleSaveReview(req, res, body);
    if (action === "deleteReview") return await handleDeleteReview(req, res, body);
    if (action === "reportReview") return await handleReportReview(req, res, body);
    return error(res, 404, "Unknown API action.");
  } catch (err) {
    const status = Number(err.status || err.statusCode || 500);
    if (status >= 500) console.error("[IconBuilds API]", status, err.message);
    return error(res, status >= 400 && status < 600 ? status : 500, status >= 500 ? "This action is temporarily unavailable." : err.message);
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
