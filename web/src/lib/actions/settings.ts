"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, canManageCompanySettings } from "@/lib/authz";
import { saveLogo, deleteLogo } from "@/lib/uploads";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { Role, EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

export type SettingsFormState = { error?: string; success?: string };

const BUILT_IN_ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "PRODUCER", "MEMBER"];

function randomPassword() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

/** The role select's value is "ROLE:ADMIN" or "CUSTOM:<id>" — see RoleSelect.tsx. */
function parseRoleSelection(value: string): { role: Role; customRoleId: string | null } | null {
  if (value.startsWith("ROLE:")) {
    const role = value.slice(5) as Role;
    if (!BUILT_IN_ROLES.includes(role)) return null;
    return { role, customRoleId: null };
  }
  if (value.startsWith("CUSTOM:")) {
    return { role: "MEMBER", customRoleId: value.slice(7) }; // least-privilege fallback; customRoleId takes over
  }
  return null;
}

export async function createUserAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage users." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleSelection = parseRoleSelection(String(formData.get("role") ?? ""));
  const isCardHolder = formData.get("isCardHolder") === "on";

  if (!name || !email || !roleSelection) return { error: "Name, email and role are required." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, role: roleSelection.role, customRoleId: roleSelection.customRoleId, isCardHolder, passwordHash },
  });

  revalidatePath("/settings");
  return { success: `Account created. Share this one-time password with ${name}: ${password}` };
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

export async function updateUserInfoAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage users." };

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const isCardHolder = formData.get("isCardHolder") === "on";
  const roleSelection = parseRoleSelection(String(formData.get("role") ?? ""));

  if (!name || !email || !roleSelection) return { error: "Name, email and role are required." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== id) return { error: "Another account already uses that email." };

  const isSelf = id === user.id;
  await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      phone,
      isCardHolder,
      // Don't let an admin change their own role by accident — everything
      // else on the page still saves normally.
      ...(isSelf ? {} : { role: roleSelection.role, customRoleId: roleSelection.customRoleId }),
    },
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function deactivateUserAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageUsers(user)) return;

  const id = String(formData.get("id"));
  if (id === user.id) return; // can't deactivate yourself

  await prisma.user.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
}

export async function reactivateUserAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageUsers(user)) return;

  const id = String(formData.get("id"));
  await prisma.user.update({ where: { id }, data: { active: true } });
  revalidatePath("/settings");
}

// --- Custom roles ---

function accessFields(formData: FormData) {
  return {
    events: formData.get("events") as EventsAccess,
    finance: formData.get("finance") as FinanceAccess,
    expenses: formData.get("expenses") as ExpensesAccess,
    settings: formData.get("settings") as SettingsAccess,
  };
}

export async function createCustomRoleAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage roles." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Role name is required." };

  const existing = await prisma.customRole.findUnique({ where: { name } });
  if (existing) return { error: "A role with that name already exists." };

  await prisma.customRole.create({ data: { name, ...accessFields(formData) } });

  revalidatePath("/settings");
  return { success: `Role "${name}" created.` };
}

export async function updateCustomRoleAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage roles." };

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Role name is required." };

  const existing = await prisma.customRole.findUnique({ where: { name } });
  if (existing && existing.id !== id) return { error: "A role with that name already exists." };

  await prisma.customRole.update({ where: { id }, data: { name, ...accessFields(formData) } });

  revalidatePath("/settings");
  return { success: `Role "${name}" updated.` };
}

export async function deleteCustomRoleAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageUsers(user)) return { error: "You don't have permission to manage roles." };

  const id = String(formData.get("id"));
  const inUse = await prisma.user.count({ where: { customRoleId: id } });
  if (inUse > 0) {
    return { error: `${inUse} account${inUse === 1 ? " is" : "s are"} still assigned to this role — reassign them first.` };
  }

  await prisma.customRole.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: "Role deleted." };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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
  const removeLogo = formData.get("removeLogo") === "on";
  const logoFile = formData.get("logo");

  if (!name || !ico) return { error: "Company name and IČO are required." };

  const existing = await prisma.companySettings.findUnique({ where: { id: "singleton" } });

  let logoPath = existing?.logoPath ?? null;
  try {
    if (removeLogo && logoPath) {
      await deleteLogo(logoPath);
      logoPath = null;
    } else if (logoFile instanceof File && logoFile.size > 0) {
      const saved = await saveLogo(logoFile);
      if (saved) {
        if (logoPath) await deleteLogo(logoPath);
        logoPath = saved;
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the logo." };
  }

  await prisma.companySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", name, address, ico, dic, isVatPayer, bankAccount, defaultDueDays, logoPath },
    update: { name, address, ico, dic, isVatPayer, bankAccount, defaultDueDays, logoPath },
  });

  revalidatePath("/settings");
  return { success: getDictionary(await getLocale()).settings.company.savedMsg };
}

export async function updateAppSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return { error: "You don't have permission to edit app settings." };

  const colors = {
    bgColor: String(formData.get("bgColor") ?? "").trim(),
    surfaceColor: String(formData.get("surfaceColor") ?? "").trim(),
    inkColor: String(formData.get("inkColor") ?? "").trim(),
    accentColor: String(formData.get("accentColor") ?? "").trim(),
    positiveColor: String(formData.get("positiveColor") ?? "").trim(),
    warningColor: String(formData.get("warningColor") ?? "").trim(),
  };
  for (const value of Object.values(colors)) {
    if (!HEX_COLOR.test(value)) return { error: "Every colour must be a hex value like #ec3013." };
  }

  const locale = formData.get("locale") === "cs" ? "cs" : "en";

  await prisma.companySettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      name: "",
      address: "",
      ico: "",
      dic: "",
      ...colors,
      locale,
    },
    update: { ...colors, locale },
  });

  // Colors/locale are read by the root layout on every route, not just
  // /settings, so the whole shell needs revalidating for the change to
  // show up immediately rather than on the next unrelated navigation.
  revalidatePath("/", "layout");
  return { success: getDictionary(locale).settings.appSettings.savedMsg };
}
