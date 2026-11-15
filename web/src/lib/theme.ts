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

/**
 * The dropdown chevron drawn on every `select.input` (globals.css). A
 * background image can't use currentColor, so it's built from the ink color
 * and re-issued whenever the theme colors change.
 */
export function selectChevron(ink: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" fill="none" stroke="${ink}" stroke-opacity="0.7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// CSS custom properties, ready to spread onto an element's inline `style`.
export function colorsToCssVars(colors: AppColors): Record<string, string> {
  return {
    "--select-chevron": selectChevron(colors.ink),
    "--color-bg": colors.bg,
    "--color-surface": colors.surface,
    "--color-ink": colors.ink,
    "--color-accent": colors.accent,
    "--color-positive": colors.positive,
    "--color-warning": colors.warning,
  };
}
