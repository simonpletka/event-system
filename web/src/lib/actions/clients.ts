"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageClients, isAdmin } from "@/lib/authz";

export type ClientFormState = { error?: string };

function clientDataFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    ico: String(formData.get("ico") ?? "").trim(),
    dic: String(formData.get("dic") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
  };
}

export async function createClientAction(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const user = await requireUser();
  if (!canManageClients(user)) return { error: "You don't have permission to add clients." };

  const data = clientDataFromForm(formData);
  if (!data.name) return { error: "Company name is required." };

  const client = await prisma.client.create({ data });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const user = await requireUser();
  if (!canManageClients(user)) return { error: "You don't have permission to edit clients." };

  const id = String(formData.get("id"));
  const data = clientDataFromForm(formData);
  if (!data.name) return { error: "Company name is required." };

  await prisma.client.update({ where: { id }, data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

/** Minimal client creation used from EventForm's "+ New client" picker — mirrors quickCreateEventAction. */
export type QuickClientState = { error?: string; client?: { id: string; name: string; address: string; ico: string; dic: string } };

export async function quickCreateClientAction(_prev: QuickClientState, formData: FormData): Promise<QuickClientState> {
  const user = await requireUser();
  if (!canManageClients(user)) return { error: "You don't have permission to add clients." };

  const data = clientDataFromForm(formData);
  if (!data.name) return { error: "Company name is required." };

  const client = await prisma.client.create({ data });
  revalidatePath("/clients");
  return { client };
}

/** Admin-only, irreversible. Events linked to this client just lose the link (clientId set null via cascade-less optional FK — Prisma requires the relation be nullable, which it is). */
export async function deleteClientAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;

  const id = String(formData.get("id"));
  await prisma.event.updateMany({ where: { clientId: id }, data: { clientId: null } });
  await prisma.client.delete({ where: { id } });

  revalidatePath("/clients");
  redirect("/clients");
}

// --- Contacts ---

export async function addClientContactAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageClients(user)) return;

  const clientId = String(formData.get("clientId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.clientContact.create({
    data: {
      clientId,
      name,
      role: String(formData.get("role") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientContactAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageClients(user)) return;

  const id = String(formData.get("id"));
  const clientId = String(formData.get("clientId"));
  await prisma.clientContact.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
}
