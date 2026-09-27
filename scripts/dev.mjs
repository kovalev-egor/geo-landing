import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const databaseId = config.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
if (!databaseId) {
  console.error("В wrangler.toml не найден database_id.");
  process.exit(1);
}

const child = spawn(
  "npx",
  ["wrangler", "pages", "dev", "public", "--port", "8788", "--d1", `DB=${databaseId}`],
  { stdio: "inherit", shell: process.platform === "win32" },
);

child.on("exit", (code) => process.exit(code ?? 0));
