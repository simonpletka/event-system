import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] placeholder-text hover:text-ink mb-2 -ml-1 px-1 py-0.5"
    >
      <span className="text-base leading-none">←</span>
      {children}
    </Link>
  );
}
