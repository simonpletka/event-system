import type { CompanySettings } from "@/generated/prisma/client";

export type AppColors = {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  positive: string;
  warning: string;
};

// Mirrors globals.css's :root defaults exactly, so an empty/missing
// CompanySettings row (e.g. a freshly empty-seeded dev DB) renders identically
// to before this feature existed.
export const DEFAULT_COLORS: AppColors = {
  bg: "#131211",
  surface: "#1a1918",
  ink: "#f3f2f2",
  accent: "#ec3013",
  positive: "#2dd4bf",
  warning: "#dc2626",
};

export function getAppColors(company: Pick<CompanySettings, "bgColor" | "surfaceColor" | "inkColor" | "accentColor" | "positiveColor" | "warningColor"> | null): AppColors {
  if (!company) return DEFAULT_COLORS;
  return {
    bg: company.bgColor || DEFAULT_COLORS.bg,
    surface: company.surfaceColor || DEFAULT_COLORS.surface,
    ink: company.inkColor || DEFAULT_COLORS.ink,
    accent: company.accentColor || DEFAULT_COLORS.accent,
    positive: company.positiveColor || DEFAULT_COLORS.positive,
    warning: company.warningColor || DEFAULT_COLORS.warning,
  };
}

// CSS custom properties, ready to spread onto an element's inline `style`.
export function colorsToCssVars(colors: AppColors): Record<string, string> {
  return {
    "--color-bg": colors.bg,
    "--color-surface": colors.surface,
    "--color-ink": colors.ink,
    "--color-accent": colors.accent,
    "--color-positive": colors.positive,
    "--color-warning": colors.warning,
  };
}
