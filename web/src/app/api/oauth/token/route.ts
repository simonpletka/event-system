import { prisma } from "@/lib/prisma";
import { sha256, verifyPkce, issueTokens } from "@/lib/agent/oauth";

function oauthError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Token endpoint: authorization_code (PKCE) and refresh_token grants. Refresh tokens rotate — each is single-use. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return oauthError("invalid_request", "Expected application/x-www-form-urlencoded body.");
  const grantType = String(form.get("grant_type") ?? "");
  const clientId = String(form.get("client_id") ?? "");

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const verifier = String(form.get("code_verifier") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");

    const row = await prisma.oAuthCode.findUnique({ where: { codeHash: sha256(code) } });
    // Single use: delete before any further check, so a replayed code never works twice.
    if (row) await prisma.oAuthCode.delete({ where: { codeHash: row.codeHash } }).catch(() => {});
    if (!row || row.expiresAt < new Date()) return oauthError("invalid_grant", "Code is invalid or expired.");
    if (row.clientId !== clientId || row.redirectUri !== redirectUri) return oauthError("invalid_grant", "Code was issued to a different client.");
    if (!verifier || !verifyPkce(verifier, row.codeChallenge)) return oauthError("invalid_grant", "PKCE verification failed.");

    const tokens = await issueTokens({ clientId, approvedById: row.approvedById });
    return Response.json(tokens, { headers: { "Cache-Control": "no-store" } });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "");
    const row = await prisma.oAuthToken.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { approvedBy: true },
    });
    if (!row || row.revokedAt || row.refreshExpiresAt < new Date() || row.clientId !== clientId) {
      return oauthError("invalid_grant", "Refresh token is invalid, expired or revoked.");
    }
    if (!row.approvedBy.active || row.approvedBy.role !== "ADMIN" || row.approvedBy.customRoleId) {
      return oauthError("invalid_grant", "The admin who approved this connection no longer has access.");
    }
    await prisma.oAuthToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    const tokens = await issueTokens({ clientId, approvedById: row.approvedById });
    return Response.json(tokens, { headers: { "Cache-Control": "no-store" } });
  }

  return oauthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported.");
}
