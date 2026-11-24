"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isAdmin } from "@/lib/authz";
import { getRealClient, isTestMode } from "@/lib/data-mode";
import { deleteReceipt, deleteProjectFile, deleteAvatar } from "@/lib/uploads";
import { getLocale, getDictionary } from "@/lib/i18n";

export type ResetDataState = { error?: string; done?: boolean };

/**
 * Settings → Company → Delete all data (Admin only, typed confirmation).
 * Empties the real database for a fresh start: every business record, its
 * uploaded files, and every account except the signed-in admin and the Claude
 * connector's service account. Company settings, categories, custom roles,
 * carsharing prices and connector approvals stay. Refused in the testing view
 * so it's never mistaken for a sandbox reset.
 */
export async function deleteAllDataAction(_prev: ResetDataState, formData: FormData): Promise<ResetDataState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings.resetData;
  if (!isAdmin(user)) return { error: "Not allowed." };
  if (await isTestMode()) return { error: t.testingNote };
  if (String(formData.get("confirm") ?? "").trim() !== t.confirmWord) return { error: t.wrongWord(t.confirmWord) };

  const db = getRealClient();
  const agents = await db.user.findMany({ where: { isAgent: true }, select: { id: true } });
  const keep = [user.id, ...agents.map((a) => a.id)];

  // Remember the files before their rows go.
  const [receipts, projectFiles, avatars] = await Promise.all([
    db.expense.findMany({ where: { receiptPath: { not: null } }, select: { receiptPath: true } }),
    db.projectFile.findMany({ select: { storedName: true } }),
    db.user.findMany({ where: { id: { notIn: keep }, avatarPath: { not: null } }, select: { avatarPath: true } }),
  ]);

  // Children before parents; the rest cascades (items, stops, comments, assignees, vehicles…).
  await db.oAuthToken.deleteMany({ where: { OR: [{ agentId: { notIn: keep } }, { approvedById: { notIn: keep } }] } });
  await db.invoiceEvent.deleteMany();
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.quote.deleteMany();
  await db.timeEntry.deleteMany();
  await db.expense.deleteMany();
  await db.gearReservation.deleteMany();
  await db.projectFile.deleteMany();
  await db.trip.deleteMany();
  await db.studioWork.deleteMany();
  await db.meeting.deleteMany();
  await db.project.deleteMany();
  await db.client.deleteMany();
  await db.user.deleteMany({ where: { id: { notIn: keep } } });

  await Promise.all([
    ...receipts.map((r) => deleteReceipt(r.receiptPath!)),
    ...projectFiles.map((f) => deleteProjectFile(f.storedName)),
    ...avatars.map((a) => deleteAvatar(a.avatarPath!)),
  ]);

  revalidatePath("/", "layout");
  return { done: true };
}
