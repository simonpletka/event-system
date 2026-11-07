import { prisma } from "@/lib/prisma";

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
};

/**
 * Validates an /oauth/authorize request against the registered client.
 * Returns the client (plus normalized params) or an error message — shared
 * by the consent page (to render) and the approve action (to re-check,
 * since the form's hidden fields are user-controlled).
 */
export async function validateAuthorizeRequest(raw: Record<string, string | undefined>) {
  const params: AuthorizeParams = {
    clientId: raw.client_id ?? "",
    redirectUri: raw.redirect_uri ?? "",
    codeChallenge: raw.code_challenge ?? "",
    state: raw.state ?? "",
  };
  if (raw.response_type !== "code") return { error: "Unsupported response_type (expected \"code\")." } as const;
  if (!params.codeChallenge || raw.code_challenge_method !== "S256") return { error: "PKCE (S256) is required." } as const;

  const client = params.clientId ? await prisma.oAuthClient.findUnique({ where: { id: params.clientId } }) : null;
  if (!client) return { error: "Unknown client — remove the connector in Claude and add it again." } as const;
  const allowed = JSON.parse(client.redirectUris) as string[];
  if (!allowed.includes(params.redirectUri)) return { error: "Redirect URI doesn't match the registered client." } as const;

  return { client, params } as const;
}
