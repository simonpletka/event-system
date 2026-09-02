/** Lowercase, hyphenated, diacritic-stripped (á/č/ř/š/ž/ý… → a/c/r/s/z/y) — Czech names/titles need the strip. Capped for sane URL length. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** `/projects/26-001-autumn-trade-expo` — the "YY-XXX" number is authoritative, the slugified title is decorative only (see parseProjectSlug). */
export function projectHref(project: { number: string; title: string }, suffix = ""): string {
  const slug = slugify(project.title);
  return `/projects/${project.number}${slug ? `-${slug}` : ""}${suffix}`;
}

/** Extracts the "YY-XXX" number from a project URL slug segment, or null if it doesn't start with one. */
export function parseProjectSlug(slug: string): string | null {
  return /^\d{2}-\d{3}/.exec(slug)?.[0] ?? null;
}

/** `/clients/<cuid>-aeris` — the id is authoritative, the slugified name is decorative only (see parseClientSlug). */
export function clientHref(client: { id: string; name: string }, suffix = ""): string {
  const slug = slugify(client.name);
  return `/clients/${client.id}${slug ? `-${slug}` : ""}${suffix}`;
}

/** Extracts the cuid from a client URL slug segment — cuids never contain "-", so splitting on the first one is unambiguous. */
export function parseClientSlug(slug: string): string {
  const i = slug.indexOf("-");
  return i === -1 ? slug : slug.slice(0, i);
}
