const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const assert = require("assert");

const tmp = path.join(os.tmpdir(), `iconbuilds-smoke-${Date.now()}.json`);
process.env.ICONBUILDS_DB_PATH = tmp;
process.env.ICONBUILDS_DB_BACKUP_PATH = `${tmp}.backup`;
process.env.SESSION_SECRET = "smoke-test-session-secret";
process.env.ADMIN_EMAILS = "admin@iconrealms.net";
process.env.NODE_ENV = "test";

const api = require("../api/index.js");

function makeReq(method, url, body, token, headers = {}) {
  const raw = body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
  const req = Readable.from(raw.length ? [raw] : []);
  req.method = method;
  req.url = url;
  req.headers = {
    host: "localhost:4177",
    "x-forwarded-proto": "http",
    "content-type": "application/json",
    ...headers
  };
  if (token) req.headers.authorization = `Bearer ${token}`;
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...(headers || {}) };
    },
    end(chunk = "") {
      this.body += chunk;
      this.resolve();
    },
    wait() {
      return new Promise((resolve) => {
        this.resolve = resolve;
      });
    }
  };
}

async function call(method, url, body, token, headers = {}) {
  const req = makeReq(method, url, body, token, headers);
  const res = makeRes();
  const done = res.wait();
  await api(req, res);
  await done;
  const type = res.headers["Content-Type"] || res.headers["content-type"] || "";
  if (type.includes("json")) {
    try {
      res.json = JSON.parse(res.body || "{}");
    } catch {
      throw new Error(`Unreadable JSON response from ${url}: ${res.body.slice(0, 200)}`);
    }
  }
  return res;
}

async function readDb() {
  return JSON.parse(await fs.readFile(tmp, "utf8"));
}

async function verifyLatest(token, userId) {
  const db = await readDb();
  const challenge = [...db.verificationChallenges].reverse().find((item) => item.userId === userId && !item.usedAt);
  assert(challenge?.devCode, "verification dev code should exist in test mode");
  const res = await call("POST", "/api?action=verifyEmail", { code: challenge.devCode }, token);
  assert.strictEqual(res.statusCode, 200, res.body);
  return res.json;
}

async function run() {
  await fs.writeFile(tmp, JSON.stringify({
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
  }, null, 2));

  const empty = await call("GET", "/api?action=state");
  assert.strictEqual(empty.statusCode, 200);
  assert.deepStrictEqual(empty.json.resources, []);

  const preflight = await call("OPTIONS", "/api?action=register", null, "", {
    origin: "https://minestore.org",
    "access-control-request-method": "POST"
  });
  assert.strictEqual(preflight.statusCode, 204);
  assert.strictEqual(preflight.headers["Access-Control-Allow-Origin"], "https://minestore.org");

  const blockedOrigin = await call("POST", "/api?action=register", {
    username: "BlockedOrigin",
    email: "blocked-origin@example.com",
    password: "password123",
    termsAccepted: true
  }, "", { origin: "https://evil.example" });
  assert.strictEqual(blockedOrigin.statusCode, 403);

  const adminRegister = await call("POST", "/api?action=register", {
    username: "TheStickBoy",
    email: "admin@iconrealms.net",
    password: "password123",
    termsAccepted: true,
    emailOptIn: true
  });
  assert.strictEqual(adminRegister.statusCode, 200, adminRegister.body);
  const adminVerified = await verifyLatest(adminRegister.json.token, adminRegister.json.user.id);
  assert.strictEqual(adminVerified.user.role, "admin");

  const blockedAdmin = await call("POST", "/api?action=admin", { command: "saveResource", resource: {} });
  assert.strictEqual(blockedAdmin.statusCode, 401);

  const save = await call("POST", "/api?action=admin", {
    command: "saveResource",
    resource: {
      name: "Icon Test Resource",
      shortDescription: "A private smoke-test resource created in temporary storage.",
      description: "## Overview\nThis proves publishing, state, sitemap, and downloads work without adding fake resources to the repo.",
      category: "plugins",
      status: "published",
      free: true,
      coverImage: "",
      fileUrl: "https://minestore.org/downloads/icon-test.zip",
      currentVersion: "1.0.0",
      minecraftVersions: ["1.21.6"],
      serverSoftware: ["Paper"],
      compatibility: ["Java"],
      tags: ["test"],
      ownershipLabel: "IconRealms Development"
    }
  }, adminVerified.token);
  assert.strictEqual(save.statusCode, 200, save.body);
  const resource = save.json.resources.find((item) => item.slug === "icon-test-resource");
  assert(resource, "published resource should exist in admin state");
  assert(resource.fileUrl, "admins can see protected file URL");

  const driveSave = await call("POST", "/api?action=admin", {
    command: "saveResource",
    resource: {
      name: "Drive Download Resource",
      shortDescription: "A smoke-test resource using a Google Drive source URL.",
      description: "This verifies Google Drive download links can be used without a visible file extension.",
      category: "plugins",
      status: "draft",
      free: true,
      fileUrl: "https://drive.google.com/uc?export=download&id=1gCMqOsy7oF-u5hkpc-unnD4O6iFVDFil",
      ownershipLabel: "IconRealms Development"
    }
  }, adminVerified.token);
  assert.strictEqual(driveSave.statusCode, 200, driveSave.body);
  const driveResource = driveSave.json.resources.find((item) => item.slug === "drive-download-resource");
  assert.strictEqual(driveResource.fileUrl, "https://drive.google.com/uc?export=download&id=1gCMqOsy7oF-u5hkpc-unnD4O6iFVDFil");

  const publicState = await call("GET", "/api?action=state");
  assert.strictEqual(publicState.statusCode, 200);
  const publicResource = publicState.json.resources.find((item) => item.slug === "icon-test-resource");
  assert(publicResource, "public state should show published resource");
  assert(!publicResource.fileUrl, "public state must not expose file URLs");

  const resourcePage = await call("GET", "/resources/icon-test-resource/");
  assert.strictEqual(resourcePage.statusCode, 200, resourcePage.body.slice(0, 200));
  assert(resourcePage.body.includes("Icon Test Resource"));

  const sitemap = await call("GET", "/sitemap.xml");
  assert.strictEqual(sitemap.statusCode, 200);
  assert(sitemap.body.includes("https://minestore.org/resources/?id=icon-test-resource"));
  assert(!sitemap.body.includes("/admin/"));

  const userRegister = await call("POST", "/api?action=register", {
    username: "Buyer",
    email: "buyer@example.com",
    password: "password123",
    termsAccepted: true
  });
  const userVerified = await verifyLatest(userRegister.json.token, userRegister.json.user.id);
  const addFree = await call("POST", "/api?action=addFreeResource", { resourceId: resource.id, acceptedTerms: true }, userVerified.token);
  assert.strictEqual(addFree.statusCode, 200, addFree.body);
  const download = await call("POST", "/api?action=download", { resourceId: resource.id }, userVerified.token);
  assert.strictEqual(download.statusCode, 200, download.body);
  assert(download.json.downloadUrl.includes("downloadFile"));

  const del = await call("POST", "/api?action=admin", { command: "deleteResource", id: resource.id }, adminVerified.token);
  assert.strictEqual(del.statusCode, 200, del.body);
  assert(!del.json.resources.some((item) => item.id === resource.id));

  console.log("IconBuilds smoke test passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
