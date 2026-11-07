import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";

/**
 * OAuth 2.1 plumbing for the Claude connector (/api/mcp). claude.ai registers
 * itself (RFC 7591 dynamic client registration), sends an Admin through
 * /oauth/authorize, then trades the code for tokens (PKCE S256 required).
 * Every token acts as the single isAgent service User — never as the Admin
 * who approved it — so "Created by" on a quote reads "Claude", and revoking
 * a token or deactivating that user cuts access off on the very next call.
 */

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
export const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

export const AGENT_EMAIL = "claude@agent.local";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE S256: BASE64URL(SHA256(verifier)) must equal the challenge sent to /authorize. */
export function verifyPkce(verifier: string, challenge: string) {
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/**
 * Public origin of the app. APP_BASE_URL wins (set it in production — behind
 * Caddy the raw request URL is the internal 127.0.0.1:3000), else the
 * forwarded proto/host headers, else the request URL itself.
 */
export function publicBaseUrl(req?: Request) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    if (host) return `${proto}://${host}`;
    return new URL(req.url).origin;
  }
  return "http://localhost:3000";
}

/** The service account every connector token acts as. Created on first approval; its password is random and never shown (and login rejects isAgent users anyway). */
export async function ensureAgentUser() {
  const existing = await prisma.user.findFirst({ where: { isAgent: true } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      name: "Claude",
      email: AGENT_EMAIL,
      // Accountant tier gives read access to every project/quote/invoice the
      // tools need to look up. It grants nothing beyond that by itself: the
      // agent can't log in to the web UI, and /api/mcp only exposes the
      // fixed tool list in src/lib/agent/tools.ts.
      role: "ACCOUNTANT",
      isAgent: true,
      passwordHash: await bcrypt.hash(randomToken(), 10),
    },
  });
}

export async function issueTokens(opts: { clientId: string; approvedById: string }) {
  const agent = await ensureAgentUser();
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  await prisma.oAuthToken.create({
    data: {
      clientId: opts.clientId,
      agentId: agent.id,
      approvedById: opts.approvedById,
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    },
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
  };
}

/**
 * Resolves a Bearer token to the agent's SessionUser, or null. Checks — on
 * every call — that the token isn't expired/revoked, the agent account is
 * still active, and the approving Admin is still an active Admin (demoting
 * or deactivating them kills every connection they approved).
 */
export async function authenticateAgent(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;

  const token = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: sha256(match[1].trim()) },
    include: { agent: true, approvedBy: true },
  });
  if (!token || token.revokedAt || token.accessExpiresAt < new Date()) return null;
  if (!token.agent.active || !token.agent.isAgent) return null;
  if (!token.approvedBy.active || token.approvedBy.role !== "ADMIN" || token.approvedBy.customRoleId) return null;

  // Coarse last-used stamp for the Settings connections list — at most once a minute.
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await prisma.oAuthToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }

  return {
    id: token.agent.id,
    name: token.agent.name,
    email: token.agent.email,
    // Pinned rather than read from the row, so editing the agent in Settings →
    // Users can never widen what the tools see.
    role: "ACCOUNTANT",
    isCardHolder: false,
    customRole: null,
  };
}
