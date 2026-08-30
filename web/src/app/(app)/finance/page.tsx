import { redirect } from "next/navigation";
import { requireUser, canViewFinance } from "@/lib/authz";

export default async function FinancePage() {
  const user = await requireUser();
  redirect(canViewFinance(user) ? "/finance/quotes" : "/finance/expenses");
}
