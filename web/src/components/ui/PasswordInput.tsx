"use client";

import { useState } from "react";

export function PasswordInput({
  id,
  name,
  autoComplete,
  required,
  holdToShowLabel = "Hold to show password",
}: {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  holdToShowLabel?: string;
}) {
  const [visible, setVisible] = useState(false);

  const reveal = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        className="bg-transparent border border-ink/35 px-3 py-2 pr-10 text-sm outline-none focus:border-ink w-full"
      />
      <button
        type="button"
        aria-label={holdToShowLabel}
        title={holdToShowLabel}
        onMouseDown={reveal}
        onMouseUp={hide}
        onMouseLeave={hide}
        onTouchStart={(e) => {
          e.preventDefault();
          reveal();
        }}
        onTouchEnd={hide}
        onTouchCancel={hide}
        className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center placeholder-text hover:text-ink select-none"
      >
        {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </button>
    </div>
  );
}

function EyeOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2.2" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <line x1="2" y1="13.5" x2="14" y2="2.5" />
    </svg>
  );
}
