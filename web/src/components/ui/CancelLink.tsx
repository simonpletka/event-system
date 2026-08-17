import Link from "next/link";

export function CancelLink({ href }: { href: string }) {
  return (
    <Link href={href} className="btno">
      Cancel
    </Link>
  );
}
