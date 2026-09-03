"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditProject, canCreateProject, isAdmin } from "@/lib/authz";
import { resolveClientId, syncClientContacts } from "@/lib/actions/clients";
import { nextProjectNumber } from "@/lib/document-number";
import { addDays } from "@/lib/calendar";
import { normaliseBudgetInput } from "@/lib/project-budget";
import { tryCreateNotionProjectPage, tryMarkNotionProjectDeleted } from "@/lib/notion";
import { projectHref } from "@/lib/slug";
import type { ProjectStatus } from "@/generated/prisma/enums";

export type ProjectFormState = { error?: string };

function parseVenues(formData: FormData) {
  const names = formData.getAll("venueName") as string[];
  const addresses = formData.getAll("venueAddress") as string[];
  const notes = formData.getAll("venueNote") as string[];
  const venues: { name: string; address: string; note: string }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i]?.trim()) {
      venues.push({ name: names[i].trim(), address: (addresses[i] ?? "").trim(), note: (notes[i] ?? "").trim() });
    }
  }
  return venues;
}

/** Selected team-member user ids from the form's hidden `memberIds` inputs. */
function parseMemberIds(formData: FormData) {
  return [...new Set((formData.getAll("memberIds") as string[]).map((s) => s.trim()).filter(Boolean))];
}

function parseContacts(formData: FormData) {
  const names = formData.getAll("contactName") as string[];
  const phones = formData.getAll("contactPhone") as string[];
  const emails = formData.getAll("contactEmail") as string[];
  const contacts: { name: string; phone: string; email: string }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i]?.trim()) {
      contacts.push({ name: names[i].trim(), phone: (phones[i] ?? "").trim(), email: (emails[i] ?? "").trim() });
    }
  }
  return contacts;
}

/**
 * Budget fields, only ever read for an Admin (the form doesn't render them
 * otherwise). Returns undefined for non-admins so the spread in the actions
 * leaves the existing DB values untouched.
 */
function budgetDataFromForm(formData: FormData, isAdminUser: boolean) {
  if (!isAdminUser) return undefined;
  const type = String(formData.get("budgetType") ?? "NONE");
  const field = type === "FIXED" ? "budgetAmount" : "budgetPercent";
  return normaliseBudgetInput(type, Number(formData.get(field) ?? 0));
}

function projectDataFromForm(formData: FormData) {
  const buildDate = formData.get("buildDate") as string;
  const strikeDate = formData.get("strikeDate") as string;
  const clientId = String(formData.get("clientId") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    brief: String(formData.get("brief") ?? "").trim(),
    clientId: clientId || null,
    companyName: String(formData.get("companyName") ?? "").trim(),
    companyAddress: String(formData.get("companyAddress") ?? "").trim(),
    companyIco: String(formData.get("companyIco") ?? "").trim(),
    companyDic: String(formData.get("companyDic") ?? "").trim(),
    status: formData.get("status") as ProjectStatus,
    buildDate: buildDate ? new Date(buildDate) : null,
    startDate: new Date(formData.get("startDate") as string),
    endDate: new Date(formData.get("endDate") as string),
    strikeDate: strikeDate ? new Date(strikeDate) : null,
    // quotedValue is deliberately absent here — it's never form-submitted.
    // It's derived (latest quote, else latest invoice, else 0) and kept in
    // sync by syncQuotedValue() at every quote/invoice mutation site in
    // lib/actions/finance.ts, so a project starts at the schema default (0)
    // and updates never touch it.
  };
}

export async function createProjectAction(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  if (!canCreateProject(user)) {
    return { error: "You don't have permission to create projects." };
  }

  const data = projectDataFromForm(formData);
  const contacts = parseContacts(formData);
  if (!data.title || !data.companyName || contacts.length === 0) {
    return { error: "Title, client company and at least one contact person are required." };
  }
  data.clientId = await resolveClientId(data.clientId, {
    name: data.companyName,
    address: data.companyAddress,
    ico: data.companyIco,
    dic: data.companyDic,
  });
  await syncClientContacts(data.clientId, contacts);

  const memberIds = [...new Set([user.id, ...parseMemberIds(formData)])];

  const number = await nextProjectNumber();
  const project = await prisma.project.create({
    data: {
      ...data,
      ...budgetDataFromForm(formData, isAdmin(user)),
      number,
      ownerId: user.id,
      venues: { create: parseVenues(formData) },
      contacts: { create: contacts.map((c, idx) => ({ ...c, sortOrder: idx })) },
      members: { create: memberIds.map((userId) => ({ userId })) },
    },
  });

  // Best-effort, one-way push to the company Notion dashboard — never blocks
  // project creation. On success, the returned page id is stashed on the
  // project so a later Meeting synced to Notion can link back to it via a
  // relation property (see createNotionMeetingPage); the update is itself
  // wrapped so a failure here only degrades that link, never the project
  // that already exists.
  const notionPageId = await tryCreateNotionProjectPage(project);
  if (notionPageId) {
    await prisma.project.update({ where: { id: project.id }, data: { notionPageId } }).catch(() => {});
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(projectHref(project));
}

export async function updateProjectAction(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));

  const existing = await prisma.project.findUnique({ where: { id }, include: { members: true } });
  if (!existing) return { error: "Project not found." };
  if (!canEditProject(user, { ownerId: existing.ownerId, memberIds: existing.members.map((m) => m.userId) })) {
    return { error: "You don't have permission to edit this project." };
  }

  const data = projectDataFromForm(formData);
  const contacts = parseContacts(formData);
  if (!data.title || !data.companyName || contacts.length === 0) {
    return { error: "Title, client company and at least one contact person are required." };
  }
  data.clientId = await resolveClientId(data.clientId, {
    name: data.companyName,
    address: data.companyAddress,
    ico: data.companyIco,
    dic: data.companyDic,
  });
  await syncClientContacts(data.clientId, contacts);

  // Sync the team from the picker. The owner is always kept even if somehow
  // deselected; a deselected roadmap-assignee is removed here (an explicit
  // team edit wins over the assign-time auto-add).
  const currentMemberIds = new Set(existing.members.map((m) => m.userId));
  const wantMemberIds = new Set([existing.ownerId, ...parseMemberIds(formData)]);
  const toRemove = [...currentMemberIds].filter((uid) => !wantMemberIds.has(uid));
  const toAdd = [...wantMemberIds].filter((uid) => !currentMemberIds.has(uid));

  await prisma.$transaction([
    prisma.venue.deleteMany({ where: { projectId: id } }),
    prisma.projectContact.deleteMany({ where: { projectId: id } }),
    ...(toRemove.length ? [prisma.projectMember.deleteMany({ where: { projectId: id, userId: { in: toRemove } } })] : []),
    ...(toAdd.length ? [prisma.projectMember.createMany({ data: toAdd.map((userId) => ({ projectId: id, userId })) })] : []),
    prisma.project.update({
      where: { id },
      data: {
        ...data,
        ...budgetDataFromForm(formData, isAdmin(user)),
        venues: { create: parseVenues(formData) },
        contacts: { create: contacts.map((c, idx) => ({ ...c, sortOrder: idx })) },
      },
    }),
  ]);

  revalidatePath(`/projects/${id}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(projectHref({ number: existing.number, title: data.title }));
}

/**
 * Admin-only, irreversible: cascades through the schema's onDelete: Cascade
 * relations (members, venues, milestones, time entries, quotes+items,
 * invoices+items/payments/history) — see CLAUDE.md for the full list.
 *
 * Refuses to delete a project that has any expenses or invoices recorded
 * against it — those need to be reassigned or removed first rather than
 * silently wiped out along with everything else. The primary gate is
 * client-side (DeleteProjectButton shows a popup explaining why and never
 * submits in that case); this check is defense in depth against a stale
 * page or a direct spoofed request, so it silently no-ops rather than
 * throwing (matches the isAdmin check just above it). Quotes aren't part of
 * this gate — an accepted-but-not-yet-invoiced quote is still safe to lose
 * along with the project, same as a draft. Since expenses always block the
 * delete, there's never a receipt file left to clean up here.
 */
export async function deleteProjectAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;

  const id = String(formData.get("id"));
  const [expenseCount, invoiceCount, existing] = await Promise.all([
    prisma.expense.count({ where: { projectId: id } }),
    prisma.invoice.count({ where: { projectId: id } }),
    prisma.project.findUnique({ where: { id }, select: { notionPageId: true } }),
  ]);
  if (expenseCount > 0 || invoiceCount > 0) return;

  await prisma.project.delete({ where: { id } });

  if (existing?.notionPageId) {
    await tryMarkNotionProjectDeleted(existing.notionPageId);
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/finance/quotes");
  revalidatePath("/finance/invoices");
  revalidatePath("/finance/expenses");
  redirect("/projects");
}

export type QuickProjectState = {
  error?: string;
  project?: { id: string; title: string; companyName: string; quotedValue: number };
};

/**
 * Minimal project creation used from the "+ New project" modal on the Quote/
 * Invoice/Expense forms — just enough fields to pick the project right
 * after, not the full ProjectForm. Returns the created project instead of
 * redirecting so the modal can hand it back to the picker without leaving
 * the page.
 */
export async function quickCreateProjectAction(_prev: QuickProjectState, formData: FormData): Promise<QuickProjectState> {
  const user = await requireUser();
  if (!canCreateProject(user)) return { error: "You don't have permission to create projects." };

  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!title || !clientName || !companyName || !startDate || !endDate) {
    return { error: "All fields are required." };
  }

  const number = await nextProjectNumber();
  const project = await prisma.project.create({
    data: {
      title,
      number,
      companyName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ownerId: user.id,
      contacts: { create: [{ name: clientName }] },
      members: { create: [{ userId: user.id }] },
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { project: { id: project.id, title: project.title, companyName: project.companyName, quotedValue: project.quotedValue } };
}

/**
 * Drag-and-drop reschedule of a whole project from the weekly calendar — shifts
 * buildDate/startDate/endDate/strikeDate (whichever are set) by the same
 * number of days, preserving each one's own time-of-day and the gaps between
 * them (a 2-day build lead stays a 2-day build lead after the move). Uses
 * addDays() (local calendar-day arithmetic) rather than raw millisecond math
 * so a shift across a DST boundary doesn't silently drift the clock time.
 */
export async function rescheduleProjectAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const deltaDays = Number(formData.get("deltaDays"));
  if (!Number.isFinite(deltaDays) || deltaDays === 0) return;

  const project = await prisma.project.findUnique({ where: { id }, include: { members: true } });
  if (!project) return;
  if (!canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) })) return;

  await prisma.project.update({
    where: { id },
    data: {
      buildDate: project.buildDate ? addDays(project.buildDate, deltaDays) : null,
      startDate: addDays(project.startDate, deltaDays),
      endDate: addDays(project.endDate, deltaDays),
      strikeDate: project.strikeDate ? addDays(project.strikeDate, deltaDays) : null,
    },
  });

  revalidatePath(`/projects/${id}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}
