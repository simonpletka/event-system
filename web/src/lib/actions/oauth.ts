"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, isAdmin } from "@/lib/authz";
import { validateAuthorizeRequest } from "@/lib/agent/authorize";
import { sha256, randomToken, AUTH_CODE_TTL_MS, ensureAgentUser } from "@/lib/agent/oauth";

function withQuery(uri: string, query: Record<string, string>) {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/** Consent screen's Approve/Deny. Admin-only; re-validates the request rather than trusting the hidden fields. */
export async function decideAuthorizationAction(formData: FormData) {
  const user = await requireUser();
  const raw = Object.fromEntries(
    ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state"].map((k) => [k, String(formData.get(k) ?? "")])
  );
  const checked = await validateAuthorizeRequest(raw);
  if ("error" in checked) redirect("/dashboard");
  const { params } = checked;

  if (formData.get("decision") !== "approve" || !isAdmin(user)) {
    redirect(withQuery(params.redirectUri, { error: "access_denied", state: params.state }));
  }

  await ensureAgentUser();
  const code = randomToken();
  await prisma.oAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: params.clientId,
      approvedById: user.id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  redirect(withQuery(params.redirectUri, { code, state: params.state }));
}

/** Settings → Claude: cut off one connection (every token issued to that client). Takes effect on the connector's very next call. */
export async function revokeConnectionAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;
  const clientId = String(formData.get("clientId"));
  await prisma.oAuthToken.updateMany({ where: { clientId, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/settings");
}
