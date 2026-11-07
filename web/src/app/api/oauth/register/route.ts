import { prisma } from "@/lib/prisma";

/**
 * RFC 7591 dynamic client registration — how claude.ai introduces itself.
 * Registering grants nothing: a client only ever gets a token after an Admin
 * approves it on /oauth/authorize. Public clients only (PKCE, no secret).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { client_name?: unknown; redirect_uris?: unknown } | null;
  const redirectUris = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  const valid = redirectUris.length > 0 && redirectUris.every(isAllowedRedirect);
  if (!valid) {
    return Response.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must be https URLs (or http://localhost)." },
      { status: 400 }
    );
  }

  const name = typeof body?.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 100) : "MCP client";
  const client = await prisma.oAuthClient.create({ data: { name, redirectUris: JSON.stringify(redirectUris) } });

  return Response.json(
    {
      client_id: client.id,
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201 }
  );
}

function isAllowedRedirect(uri: string) {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}
