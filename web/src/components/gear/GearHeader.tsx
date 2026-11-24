"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { getDictionary, type Locale } from "@/lib/dictionary";

type Tab = "catalog" | "groups" | "availability" | "reservations";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/gear/groups")) return "groups";
  if (pathname.startsWith("/gear/availability")) return "availability";
  if (pathname.startsWith("/gear/reservations")) return "reservations";
  return "catalog";
}

/** Title, per-tab subtitle and actions. Lives in the layout so the tab highlight stays mounted. */
export function GearHeader({ locale, typeCount, canManage }: { locale: Locale; typeCount: number; canManage: boolean }) {
  const t = getDictionary(locale).gear;
  const tab = activeTab(usePathname());
  const subtitle =
    tab === "groups"
      ? t.subtitleGroups
      : tab === "availability"
        ? t.subtitleAvailability
        : tab === "reservations"
          ? t.subtitleReservations
          : t.subtitleCatalog(typeCount);

  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div className="heading-label">{subtitle}</div>
        <h1 className="text-[46px] md:text-[48px] font-bold tracking-tight mt-1">{t.title}</h1>
      </div>
      {canManage && (
        <div className="flex gap-1.5 flex-wrap">
          {tab === "catalog" && (
            <Link href="/gear/new" className="btn font-semibold">
              {t.newGear}
            </Link>
          )}
          {tab === "groups" && (
            <Link href="/gear/groups?new=1" scroll={false} className="btn font-semibold">
              {t.newGroup}
            </Link>
          )}
          {(tab === "availability" || tab === "reservations") && (
            <Link href={`/gear/${tab}?reserve=1`} scroll={false} className="btn font-semibold">
              {t.reserveGear}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function GearTabs({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).gear;
  const tab = activeTab(usePathname());
  return (
    <SlidingTabs
      active={tab}
      tabs={[
        { value: "catalog", href: "/gear", label: t.tabCatalog },
        { value: "groups", href: "/gear/groups", label: t.tabGroups },
        { value: "availability", href: "/gear/availability", label: t.tabAvailability },
        { value: "reservations", href: "/gear/reservations", label: t.tabReservations },
      ]}
    />
  );
}
