const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const apiDir = path.join(__dirname, "..", "api");
const files = fs.readdirSync(apiDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.join(apiDir, file));

for (const file of files) {
  const result = spawnSync(process.execPath, ["-c", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
