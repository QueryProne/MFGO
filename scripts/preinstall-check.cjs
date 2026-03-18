const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const filePath = path.join(root, lockfile);
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // best-effort cleanup
  }
}

const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
