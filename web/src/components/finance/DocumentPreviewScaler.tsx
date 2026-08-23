"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scales a fixed-width document preview (the invoice/quote PDF preview
 * cards, built at the mockup's literal 794px page width) down to fit
 * whatever width its container actually has, so the user sees the whole
 * page at a glance instead of having to scroll it sideways. Never scales
 * up past 100% — a container wider than 794px just shows it at natural
 * size. transform:scale() doesn't shrink the element's own layout box, so
 * the wrapper's height is set explicitly from the scaled content height
 * (measured via ResizeObserver) to avoid leaving dead space below it.
 */
export function DocumentPreviewScaler({ width, children }: { width: number; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const s = Math.min(1, outer.clientWidth / width);
      setScale(s);
      setHeight(inner.scrollHeight * s);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} style={{ width: "100%", height, overflow: "hidden" }}>
      <div ref={innerRef} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
