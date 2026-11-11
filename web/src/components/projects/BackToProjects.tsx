"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIST_QUERY_KEY } from "@/lib/project-list";

/** "← Projects", returning to the list with the filters and search it last had. */
export function BackToProjects({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Link
      href="/projects"
      onClick={(e) => {
        let query = "";
        try {
          query = window.sessionStorage.getItem(LIST_QUERY_KEY) ?? "";
        } catch {
          // Storage unavailable: fall back to the plain list.
        }
        if (!query) return;
        e.preventDefault();
        router.push(`/projects${query}`);
      }}
      className="inline-block text-[12px] placeholder-text hover:text-accent mt-1"
    >
      ← {label}
    </Link>
  );
}
