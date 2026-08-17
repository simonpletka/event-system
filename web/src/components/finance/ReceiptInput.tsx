"use client";

import { useRef, useState } from "react";

export function ReceiptInput({ existingReceiptPath }: { existingReceiptPath?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [removeExisting, setRemoveExisting] = useState(false);

  function setFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setRemoveExisting(false);
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
  }

  return (
    <div>
      <div className="label mb-1.5">Receipt</div>
      {existingReceiptPath && !fileName && (
        <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
          <a
            href={`/api/uploads/receipts/${existingReceiptPath}`}
            target="_blank"
            rel="noreferrer"
            className={`hover:text-accent ${removeExisting ? "line-through placeholder-text" : ""}`}
          >
            Current receipt on file
          </a>
          <label className="flex items-center gap-1.5 text-[9px] placeholder-text">
            <input
              type="checkbox"
              name="removeReceipt"
              checked={removeExisting}
              onChange={(e) => setRemoveExisting(e.target.checked)}
            />
            Remove
          </label>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          setFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`h-[110px] flex flex-col items-center justify-center gap-1 cursor-pointer text-center px-3 ${
          dragOver ? "border border-accent" : "border border-dashed border-ink/45"
        }`}
      >
        <div className="text-[11px]">Drag the photo here</div>
        <div className="placeholder-text text-[9px]">
          or <span className="underline">choose a file</span> · JPG, PNG, PDF
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        name="receipt"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0])}
      />
      {fileName && <div className="label mt-1.5">1 file attached · {fileName}</div>}
    </div>
  );
}
