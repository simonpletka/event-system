"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/address-search";

export type StructuredAddress = { street: string; city: string; postCode: string; state: string };

/**
 * Client-only (for now) structured counterpart to AddressAutocompleteInput —
 * that component fills one free-text field, this one fills four separately-
 * submitted inputs (street/city/postCode/state) so a Client's address can be
 * queried/displayed by part. The street field drives the same Photon-backed
 * worldwide autocomplete; picking a suggestion fills all four fields at
 * once, and each stays independently editable afterward — Photon doesn't
 * always resolve every component (e.g. no postcode for a broad village
 * match), so the user needs to be able to fill gaps by hand.
 */
type T = { streetPlaceholder: string; searching: string; postCodePlaceholder: string; cityPlaceholder: string; statePlaceholder: string };

export function StructuredAddressInput({
  value,
  onChange,
  t = { streetPlaceholder: "Street and number", searching: "Searching…", postCodePlaceholder: "Post code", cityPlaceholder: "City", statePlaceholder: "State / region" },
}: {
  value: StructuredAddress;
  onChange: (value: StructuredAddress) => void;
  t?: T;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof StructuredAddress>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  function handleStreetChange(next: string) {
    set("street", next);
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
    <div className="flex flex-col gap-3">
      <div className="relative" ref={containerRef}>
        <input
          name="street"
          value={value.street}
          onChange={(e) => handleStreetChange(e.target.value)}
          onFocus={() => value.street.trim().length >= 3 && setOpen(true)}
          placeholder={t.streetPlaceholder}
          autoComplete="off"
          className="input w-full"
        />
        {open && (loading || suggestions.length > 0) && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface border border-ink/30 max-h-52 overflow-y-auto">
            {loading && <div className="px-2.5 py-1.5 text-[11px] placeholder-text">{t.searching}</div>}
            {!loading &&
              suggestions.map((s, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    onChange({ street: s.street || value.street, city: s.city, postCode: s.postCode, state: s.state });
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
      <div className="grid grid-cols-2 gap-3">
        <input name="postCode" value={value.postCode} onChange={(e) => set("postCode", e.target.value)} placeholder={t.postCodePlaceholder} className="input" />
        <input name="city" value={value.city} onChange={(e) => set("city", e.target.value)} placeholder={t.cityPlaceholder} className="input" />
      </div>
      <input name="state" value={value.state} onChange={(e) => set("state", e.target.value)} placeholder={t.statePlaceholder} className="input" />
    </div>
  );
}
