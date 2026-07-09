// Screenshot the running app with the locally cached Playwright Chromium.
// Usage: node .claude/skills/busplanner/scripts/screenshot.mjs <outfile.png> [width] [height] [waitMs] [touch]
// Run from the repo root; requires frontend/node_modules (playwright-core) and
// a Playwright Chromium under ~/Library/Caches/ms-playwright/.
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(
  new URL("../../../../frontend/package.json", import.meta.url),
);
const { chromium } = require("playwright-core");

const [outfile = "screenshot.png", width = "1400", height = "900", waitMs = "8000", touch] =
  process.argv.slice(2);

const cacheDir = path.join(os.homedir(), "Library/Caches/ms-playwright");
const chromiumDir = fs
  .readdirSync(cacheDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
if (!chromiumDir) {
  console.error("No cached Playwright Chromium found in", cacheDir);
  process.exit(1);
}
const exe = path.join(
  cacheDir,
  chromiumDir,
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
);

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  hasTouch: touch === "touch",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: outfile });
console.log("saved", outfile, "| page errors:", errors.length ? errors : "none");
await browser.close();
