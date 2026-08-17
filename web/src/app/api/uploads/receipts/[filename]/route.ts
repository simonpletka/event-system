import { prisma } from "@/lib/prisma";
import { requireUser, expenseWhereForUser } from "@/lib/authz";
import { readReceipt } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const user = await requireUser();
  const { filename } = await params;

  const expense = await prisma.expense.findFirst({
    where: { receiptPath: filename, ...expenseWhereForUser(user) },
  });
  if (!expense) return new Response("Not found", { status: 404 });

  try {
    const { buffer, contentType } = await readReceipt(filename);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
