"use client";

import { Menu, MenuLink } from "@/components/ui/Menu";

type SortLabels = { label: string; newest: string; oldest: string; numberDesc: string; numberAsc: string };

/** Sort menu for the quote / invoice lists — by issue date or document number. */
export function FinanceSortMenu({
  current,
  basePath,
  params,
  t,
}: {
  current: string | undefined;
  basePath: string;
  /** The other list params to carry through so sorting keeps the filters. */
  params: Record<string, string | undefined>;
  t: SortLabels;
}) {
  const sort = current || "date_desc";
  const opts: [string, string][] = [
    ["date_desc", t.newest],
    ["date_asc", t.oldest],
    ["number_desc", t.numberDesc],
    ["number_asc", t.numberAsc],
  ];

  const href = (s: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, sort: s })) if (v) p.set(k, v);
    return `${basePath}?${p.toString()}`;
  };

  const currentLabel = opts.find(([v]) => v === sort)?.[1] ?? t.newest;

  return (
    <Menu triggerLabel={t.label} triggerValue={currentLabel} width={160}>
      {opts.map(([v, l]) => (
        <MenuLink key={v} href={href(v)} active={v === sort}>
          {l}
        </MenuLink>
      ))}
    </Menu>
  );
}
