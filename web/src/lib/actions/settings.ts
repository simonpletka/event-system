"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, canManageCompanySettings } from "@/lib/authz";
import type { Role } from "@/generated/prisma/enums";

export type SettingsFormState = { error?: string; success?: string };

function randomPassword() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export async function createUserAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage users." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") as Role;
  const isCardHolder = formData.get("isCardHolder") === "on";

  if (!name || !email || !role) return { error: "Name, email and role are required." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({ data: { name, email, role, isCardHolder, passwordHash } });

  revalidatePath("/settings");
  return { success: `Account created. Share this one-time password with ${name}: ${password}` };
}

export async function updateUserRoleAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageUsers(user)) return;

  const id = String(formData.get("id"));
  const role = formData.get("role") as Role;
  if (id === user.id) return; // don't let an admin demote themselves by accident
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

export async function toggleCardHolderAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageUsers(user)) return;

  const id = String(formData.get("id"));
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) return;
  await prisma.user.update({ where: { id }, data: { isCardHolder: !current.isCardHolder } });
  revalidatePath("/settings");
}

export async function resetPasswordAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage users." };

  const id = String(formData.get("id"));
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found." };

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  revalidatePath("/settings");
  return { success: `New one-time password for ${target.name}: ${password}` };
}

export async function updateCompanySettingsAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return { error: "You don't have permission to edit company settings." };

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const ico = String(formData.get("ico") ?? "").trim();
  const dic = String(formData.get("dic") ?? "").trim();
  const isVatPayer = formData.get("isVatPayer") === "on";
  const bankAccount = String(formData.get("bankAccount") ?? "").trim();
  const defaultDueDays = Math.max(1, Number(formData.get("defaultDueDays")) || 14);

  if (!name || !ico) return { error: "Company name and IČO are required." };

  await prisma.companySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", name, address, ico, dic, isVatPayer, bankAccount, defaultDueDays },
    update: { name, address, ico, dic, isVatPayer, bankAccount, defaultDueDays },
  });

  revalidatePath("/settings");
  return { success: "Company settings saved." };
}
