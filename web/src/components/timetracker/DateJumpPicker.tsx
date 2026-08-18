"use client";

import { useRouter } from "next/navigation";

/**
 * Native date input used purely to jump the period anchor — its own popup IS
 * the "select via calendar" affordance. Takes a plain `base` URL (query
 * string minus `date`) rather than a hrefFor callback, since functions can't
 * cross the server/client boundary as props.
 */
export function DateJumpPicker({ value, base }: { value: string; base: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      defaultValue={value}
      className="input text-[10px] py-1.5 w-[132px]"
      onChange={(e) => {
        if (!e.target.value) return;
        const sep = base.includes("?") ? "&" : "?";
        router.push(`${base}${sep}date=${e.target.value}`);
      }}
    />
  );
}
