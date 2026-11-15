"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/address-search";

/**
 * Free-text field with a worldwide autocomplete dropdown (Photon/OSM — see
 * src/lib/address-search.ts). `kind="place"` searches named places (venues)
 * instead of addresses; each suggestion then carries `name` and `address`.
 */
export function AddressAutocompleteInput({
  name,
  value,
  onChange,
  onSelect,
  placeholder,
  className = "input",
  searchingLabel = "Searching…",
  kind = "address",
  required,
  savedLabel = "Used before",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  searchingLabel?: string;
  kind?: "address" | "place";
  required?: boolean;
  /** Tag on a venue suggestion that comes from earlier projects, not the map. */
  savedLabel?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleInputChange(next: string) {
    onChange(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/address-search?q=${encodeURIComponent(next)}${kind === "place" ? "&kind=place" : ""}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        name={name}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => value.trim().length >= 3 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={`${className} w-full`}
      />
      {open && (loading || suggestions.length > 0) && (
        <div className={`absolute z-20 top-full left-0 mt-1.5 card p-1.5 max-h-64 overflow-y-auto shadow-[0_18px_44px_rgba(0,0,0,0.5)] ${kind === "place" ? "w-max min-w-full max-w-[min(420px,85vw)]" : "right-0"}`}>
          {loading && <div className="px-2.5 py-1.5 text-[12px] placeholder-text">{searchingLabel}</div>}
          {!loading &&
            suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  onChange(kind === "place" && s.name ? s.name : s.label);
                  onSelect?.(s);
                  setSuggestions([]);
                  setOpen(false);
                }}
                className="block w-full text-left px-2.5 py-1.5 rounded-md text-[13px] text-ink/85 hover:bg-ink/8 hover:text-ink transition-colors"
              >
                {kind === "place" && s.name ? (
                  <>
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      {s.name}
                      {s.saved && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-accent">
                          {savedLabel}
                        </span>
                      )}
                    </span>
                    {s.address && <span className="block text-[11.5px] placeholder-text">{s.address}</span>}
                  </>
                ) : (
                  s.label
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
