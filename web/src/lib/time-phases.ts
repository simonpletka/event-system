import type { TimePhase } from "@/generated/prisma/enums";

export const PHASE_LABEL: Record<TimePhase, string> = {
  PLANNING: "Planning",
  SUPPLIERS: "Suppliers",
  ON_SITE: "On site",
  WRAP_UP: "Wrap-up",
};

export const PHASES = Object.keys(PHASE_LABEL) as TimePhase[];
