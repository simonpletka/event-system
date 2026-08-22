// Generates a simple placeholder app icon + splash source image from the
// app's own tokens (dark bg, accent orange) so `npm run icons` has
// something to work from immediately. Swap assets/icon.png for real
// branding art whenever it's ready, then re-run `npm run icons`.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetPath = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));

const BG = "#131211";
const ACCENT = "#ec3013";
const INK = "#f3f2f2";

mkdirSync(new URL("../assets/", import.meta.url), { recursive: true });

const iconSvg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${BG}"/>
  <circle cx="512" cy="470" r="190" fill="${ACCENT}"/>
  <text x="512" y="800" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="700"
        letter-spacing="8" fill="${INK}" text-anchor="middle">EVENT SYSTEM</text>
</svg>`;

const splashSvg = `
<svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
  <rect width="2732" height="2732" fill="${BG}"/>
  <circle cx="1366" cy="1366" r="220" fill="${ACCENT}"/>
</svg>`;

await sharp(Buffer.from(iconSvg)).png().toFile(assetPath("icon.png"));
await sharp(Buffer.from(splashSvg)).png().toFile(assetPath("splash.png"));
await sharp(Buffer.from(splashSvg)).png().toFile(assetPath("splash-dark.png"));

console.log("Wrote assets/icon.png, assets/splash.png, assets/splash-dark.png");
