import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageGear } from "@/lib/authz";
import { GEAR_PHOTO_TYPES, MAX_GEAR_PHOTO_MB, saveGearIssuePhoto } from "@/lib/uploads";

/**
 * One photo per request, attached to an issue. A route handler, not a server
 * action: those cap the body at 1MB. The reporter adds photos to their own
 * report; gear managers to any.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (!GEAR_PHOTO_TYPES[file.type]) return NextResponse.json({ error: "Only images." }, { status: 415 });
  if (file.size > MAX_GEAR_PHOTO_MB * 1024 * 1024) return NextResponse.json({ error: "File too large." }, { status: 413 });

  const issue = await prisma.gearIssue.findUnique({ where: { id: String(formData.get("issueId") ?? "") }, select: { id: true, reportedById: true } });
  if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  if (issue.reportedById !== user.id && !canManageGear(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if ((await prisma.gearIssuePhoto.count({ where: { issueId: issue.id } })) >= 10) return NextResponse.json({ error: "Too many photos." }, { status: 400 });

  const storedName = await saveGearIssuePhoto(file);
  await prisma.gearIssuePhoto.create({
    data: { issueId: issue.id, storedName, originalName: file.name.slice(0, 200), contentType: file.type, size: file.size },
  });
  revalidatePath("/gear", "layout");
  revalidatePath("/g", "layout");
  return NextResponse.json({ ok: true });
}
