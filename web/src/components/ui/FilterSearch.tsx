"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { listUrl } from "@/lib/list-url";

/** Free-text list filter — filters as you type (debounced), carrying the
 *  other list params. Replaces the old form + Apply button. */
export function FilterSearch({
  value,
  basePath,
  params,
  placeholder,
}: {
  value: string;
  basePath: string;
  params: Record<string, string | undefined>;
  placeholder: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [urlValue, setUrlValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when the URL's q changes from outside this input (e.g. the
  // "Clear" link). Derived-state pattern — runs during render, not an effect.
  if (value !== urlValue) {
    setUrlValue(value);
    setV(value);
  }

  const push = (next: string) => {
    setUrlValue(next);
    router.push(listUrl(basePath, params, { q: next || undefined }));
  };

  const onChange = (raw: string) => {
    setV(raw);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(raw.trim()), 300);
  };

  return (
    <div className="relative shrink-0">
      <input
        value={v}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            push(v.trim());
          }
        }}
        placeholder={placeholder}
        className="input text-[12px] py-1.5 pl-3 pr-8 w-[160px] !rounded-full"
      />
      {v ? (
        <button
          type="button"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            setV("");
            push("");
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/45 hover:text-ink leading-none"
        >
          ×
        </button>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )}
    </div>
  );
}
