"use client";

import { useState } from "react";

export type PreviewSection = { title: string; screens: { label: string; href: string }[] };

const DEVICES = [
  { name: "Android 360", width: 360, height: 780 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 15", width: 390, height: 844 },
  { name: "Pro Max", width: 430, height: 932 },
];

/** Next's dev badge sits over the bottom tab bar, so hide it inside the frames. */
function hideDevBadge(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument;
  if (!doc) return;
  const style = doc.createElement("style");
  style.textContent = "nextjs-portal { display: none; }";
  doc.head.append(style);
}

export function MobilePreview({ sections }: { sections: PreviewSection[] }) {
  const [device, setDevice] = useState(DEVICES[2]);
  const [section, setSection] = useState<string | null>(null);
  const shown = section ? sections.filter((s) => s.title === section) : sections;

  return (
    <main className="min-h-screen p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold mr-3">Mobile preview</h1>
        {DEVICES.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => setDevice(d)}
            className={d === device ? "btn" : "btno"}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {[null, ...sections.map((s) => s.title)].map((title) => (
          <button
            key={title ?? "all"}
            type="button"
            onClick={() => setSection(title)}
            className={title === section ? "btn" : "btno"}
          >
            {title ?? "All"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-6 mt-6">
        {shown.flatMap((s) =>
          s.screens.map((screen) => (
            <figure key={screen.href}>
              <figcaption className="text-[12px] mb-1.5 flex justify-between gap-3" style={{ width: device.width }}>
                <span>
                  <span className="placeholder-text">{s.title} /</span> {screen.label}
                </span>
                <a href={screen.href} target="_blank" rel="noopener noreferrer" className="placeholder-text underline">
                  Open
                </a>
              </figcaption>
              <iframe
                src={screen.href}
                title={`${s.title}: ${screen.label}`}
                loading="lazy"
                onLoad={(e) => hideDevBadge(e.currentTarget)}
                width={device.width}
                height={device.height}
                className="rounded-[28px] border-4 border-ink/20 bg-bg box-content"
              />
            </figure>
          ))
        )}
      </div>
    </main>
  );
}
