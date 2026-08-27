"use client";

import { useRouter } from "next/navigation";
import { DateTimeField } from "@/components/ui/DateTimeField";

/**
 * Jump the period anchor to any date. Takes a plain `base` URL (query string
 * minus `date`) rather than a hrefFor callback, since functions can't cross
 * the server/client boundary as props.
 */
export function DateJumpPicker({ value, base }: { value: string; base: string }) {
  const router = useRouter();

  return (
    <div className="w-[150px]">
      <DateTimeField
        name="jumpDate"
        value={value}
        onChange={(v) => {
          if (!v) return;
          const sep = base.includes("?") ? "&" : "?";
          router.push(`${base}${sep}date=${v}`);
        }}
        className="!text-[10px] !py-1.5"
      />
    </div>
  );
}
