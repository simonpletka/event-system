"use client";

import { useState } from "react";

/**
 * Hidden `tzOffsetMinutes` field carrying the browser's
 * `Date.getTimezoneOffset()` (minutes to add to local time to reach UTC)
 * into a server action, so wall-clock date/time inputs are interpreted in
 * the viewer's zone rather than the server's. Seeded via the lazy useState
 * initializer to keep `new Date()` out of the render body (react-hooks/purity).
 */
export function TzOffsetField() {
  const [offset] = useState(() => new Date().getTimezoneOffset());
  return <input type="hidden" name="tzOffsetMinutes" value={offset} />;
}
