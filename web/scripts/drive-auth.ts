/**
 * One-time sign-in for the Google Drive connection: run `npm run drive:auth`,
 * approve in the browser as the owner of the root folder, and the refresh
 * token lands in .env without ever being printed. See docs/API_SETUP.md.
 */
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import { google } from "googleapis";

const ENV_FILE = ".env";
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;

process.loadEnvFile(ENV_FILE);
const { GDRIVE_OAUTH_CLIENT_ID: clientId, GDRIVE_OAUTH_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Add GDRIVE_OAUTH_CLIENT_ID and GDRIVE_OAUTH_CLIENT_SECRET to .env first.");
  process.exit(1);
}

function saveRefreshToken(token: string) {
  const line = `GDRIVE_OAUTH_REFRESH_TOKEN="${token}"`;
  const env = readFileSync(ENV_FILE, "utf8");
  const existing = /^GDRIVE_OAUTH_REFRESH_TOKEN=.*$/m;
  writeFileSync(ENV_FILE, existing.test(env) ? env.replace(existing, line) : `${env.trimEnd()}\n${line}\n`);
}

const client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const state = randomBytes(16).toString("hex");
const url = client.generateAuthUrl({
  access_type: "offline",
  // Google only returns a refresh token on a fresh consent.
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
  state,
});

const server = createServer(async (req, res) => {
  const params = new URL(req.url ?? "/", REDIRECT_URI).searchParams;
  const code = params.get("code");
  if (!code) {
    res.end();
    return;
  }
  if (params.get("state") !== state) {
    res.end("This sign-in link doesn't match. Run npm run drive:auth again.");
    return;
  }
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error("Google didn't return a refresh token.");
    saveRefreshToken(tokens.refresh_token);
    res.end("Connected. You can close this tab.");
    console.log("Connected. GDRIVE_OAUTH_REFRESH_TOKEN saved to .env.");
    server.close();
  } catch (e) {
    res.end("Sign-in failed. See the terminal.");
    console.error("Sign-in failed:", e instanceof Error ? e.message : e);
    server.close();
    process.exitCode = 1;
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Open this link and approve as the owner of the root folder:\n\n${url}\n`);
});
