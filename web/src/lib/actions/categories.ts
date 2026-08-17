"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageCompanySettings } from "@/lib/authz";

export type CategoryFormState = { error?: string };

/** Org-wide default line-item categories, offered on every quote/invoice's line-item category picker. */
export async function getItemCategories() {
  return prisma.itemCategory.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return { error: "You don't have permission to manage categories." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const existing = await prisma.itemCategory.findUnique({ where: { name } });
  if (existing) return { error: "A category with that name already exists." };

  const count = await prisma.itemCategory.count();
  await prisma.itemCategory.create({ data: { name, sortOrder: count } });

  revalidatePath("/settings");
  return {};
}

export async function renameCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return;

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.itemCategory.update({ where: { id }, data: { name } });
  revalidatePath("/settings");
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageCompanySettings(user)) return;

  const id = String(formData.get("id"));
  await prisma.itemCategory.delete({ where: { id } });
  revalidatePath("/settings");
}
