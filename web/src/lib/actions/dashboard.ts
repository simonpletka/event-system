"use server";

import { requireUser } from "@/lib/authz";
import { getDashboardMonth } from "@/lib/queries/dashboard";
import type { DashProject } from "@/lib/dashboard-types";

/** Projects for one month of the dashboard calendar, scoped like the rest of the dashboard. */
export async function loadDashboardMonthAction(month: string): Promise<DashProject[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month.");
  const user = await requireUser();
  return getDashboardMonth(user, month);
}
