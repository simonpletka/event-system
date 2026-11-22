// Copies the built Studio apps into the repo, so deploys ship them.
// The apps live next to this project (../../<folder>); run this after rebuilding one.
// Usage: npm run studio:sync
import { copyFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(web, "..", "..");
const APPS = [
  ["vmix-placeholders", "VMIX INPUT PLACEHOLDER/index.html"],
  ["shortcut-cheatsheet", "SHORTCUT CHEATSHEET/index.html"],
  ["setup-diagram", "SETUP_DIAGRAM/dist/index.html"],
];

for (const [slug, source] of APPS) {
  const from = join(work, source);
  const to = join(web, "studio-apps", `${slug}.html`);
  copyFileSync(from, to);
  console.log(`${slug}: ${(statSync(to).size / 1024).toFixed(0)} KB from ${source}`);
}
