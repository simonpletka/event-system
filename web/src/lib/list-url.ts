/** Build a list-page URL, merging the current params with overrides and
 *  dropping any that are empty. `undefined` in an override clears that key. */
export function listUrl(
  basePath: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...overrides })) {
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
