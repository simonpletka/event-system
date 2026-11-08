import type { ProjectStatus } from "@/generated/prisma/enums";

/** A project as the dashboard shows it. Dates are ISO strings so it crosses to client components. */
export type DashProject = {
  id: string;
  number: string;
  title: string;
  client: string;
  status: ProjectStatus;
  start: string;
  end: string;
  venue: string | null;
  nextMilestone: { title: string; date: string } | null;
  href: string;
};
