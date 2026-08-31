"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/address-search";

/** Free-text address field with a worldwide autocomplete dropdown (Photon/OSM — see src/lib/address-search.ts). */
export function AddressAutocompleteInput({
  name,
  value,
  onChange,
  placeholder,
  className = "input",
  searchingLabel = "Searching…",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchingLabel?: string;
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
        const res = await fetch(`/api/address-search?q=${encodeURIComponent(next)}`);
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
        autoComplete="off"
        className={`${className} w-full`}
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface border border-ink/30 max-h-52 overflow-y-auto">
          {loading && <div className="px-2.5 py-1.5 text-[11px] placeholder-text">{searchingLabel}</div>}
          {!loading &&
            suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  onChange(s.label);
                  setSuggestions([]);
                  setOpen(false);
                }}
                className="block w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-ink/10"
              >
                {s.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
