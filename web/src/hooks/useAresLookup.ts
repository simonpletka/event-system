"use client";

import { useState } from "react";
import type { AresCompany } from "@/lib/ares";

export function useAresLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(ico: string): Promise<AresCompany | null> {
    setError(null);
    if (!ico.trim()) {
      setError("Enter an IČO first.");
      return null;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(ico.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lookup failed.");
        return null;
      }
      return data.company as AresCompany;
    } catch {
      setError("Couldn't reach ARES — try again in a moment.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
