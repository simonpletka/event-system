// Plain helpers, usable from Server and Client Components alike (no "use client":
// a server page calling a function from a client module is a runtime error).
import { formatPragueDate } from "@/lib/prague-date";
import type { Locale } from "@/lib/dictionary";

/** Diacritics- and case-insensitive, so "cocka" finds "Čočka". */
export function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Teal when everything is free, amber when some is, red when none is. Semantic colours only. */
export function freeTone(free: number, total: number): "positive" | "attention" | "warning" | "neutral" {
  if (total === 0) return "neutral";
  if (free <= 0) return "warning";
  if (free < total) return "attention";
  return "positive";
}

export const TONE_TEXT: Record<ReturnType<typeof freeTone>, string> = {
  positive: "text-positive",
  attention: "text-attention",
  warning: "text-warning",
  neutral: "placeholder-text",
};

export const TONE_DOT: Record<ReturnType<typeof freeTone>, string> = {
  positive: "bg-positive",
  attention: "bg-attention",
  warning: "bg-warning",
  neutral: "bg-ink/30",
};

/** "26 Nov" or "26 – 27 Nov" for plain "YYYY-MM-DD" keys. Noon UTC keeps the day the same in Prague. */
export function formatDayRange(startDate: string, endDate: string, locale: Locale) {
  const fmt = (key: string) => formatPragueDate(`${key}T12:00:00Z`, locale, { day: "numeric", month: "short" });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function formatDay(key: string, locale: Locale, opts: Intl.DateTimeFormatOptions) {
  return formatPragueDate(`${key}T12:00:00Z`, locale, opts);
}

export function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

/** Two-option pill switch (All / Free today, Auto / Custom). */
export function PillSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-full border border-ink/16 bg-ink/5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`px-4 min-h-[34px] rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase whitespace-nowrap transition-colors ${
            o.value === value ? "bg-accent text-white" : "text-ink/55 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
