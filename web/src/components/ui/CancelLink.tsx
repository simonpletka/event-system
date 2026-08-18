import Link from "next/link";

export function CancelLink({ href, label = "Cancel" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="btno">
      {label}
    </Link>
  );
}
