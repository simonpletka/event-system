"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { listUrl } from "@/lib/list-url";

/** Free-text list filter — commits on Enter or the search-icon click,
 *  carrying the other list params. Replaces the old form + Apply button.
 *  Uncontrolled, keyed on `value` so it re-syncs when the URL's q changes. */
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
  const ref = useRef<HTMLInputElement>(null);

  const commit = () => router.push(listUrl(basePath, params, { q: ref.current?.value.trim() || undefined }));

  return (
    <div className="relative shrink-0">
      <input
        key={value}
        ref={ref}
        defaultValue={value}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        placeholder={placeholder}
        className="input text-[12px] py-1.5 pl-2.5 pr-7 w-[150px]"
      />
      <button
        type="button"
        onClick={commit}
        aria-label="Search"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink/45 hover:text-ink"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </div>
  );
}
