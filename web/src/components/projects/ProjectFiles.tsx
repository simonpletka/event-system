"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProjectFileAction } from "@/lib/actions/projects";
import { MAX_PROJECT_FILE_MB, previewOf } from "@/lib/project-files";
import { formatDate, formatFileSize } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

type T = Dictionary["projects"]["filesTab"];
type FileRow = { id: string; name: string; size: number; addedAt: string; addedBy: string };

const fileUrl = (id: string) => `/api/uploads/project-files/${id}`;

export function ProjectFiles({
  projectId,
  files,
  editable,
  locale,
}: {
  projectId: string;
  files: FileRow[];
  editable: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects.filesTab;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewable = files.filter((f) => previewOf(f.name));
  const preview = previewable.find((f) => f.id === previewId) ?? null;

  return (
    <div>
      {editable && <UploadZone projectId={projectId} t={t} />}
      {files.length === 0 ? (
        <EmptyState message={t.empty} compact />
      ) : (
        <div className="card p-3.5 mt-4">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-3 py-2 border-b border-ink/13 last:border-b-0 flex-wrap">
              <div className="min-w-0 flex-1">
                {previewOf(file.name) ? (
                  <button type="button" onClick={() => setPreviewId(file.id)} className="text-left text-[13px] break-all hover:text-accent">
                    {file.name}
                  </button>
                ) : (
                  <span className="text-[13px] break-all">{file.name}</span>
                )}
                <div className="text-[11px] placeholder-text">
                  {formatFileSize(file.size)} · {file.addedBy} · {formatDate(new Date(file.addedAt))}
                  {!previewOf(file.name) && ` · ${t.noPreview}`}
                </div>
              </div>
              <div className="flex gap-1.5">
                {previewOf(file.name) && (
                  <button type="button" className="btno" onClick={() => setPreviewId(file.id)}>
                    {t.preview}
                  </button>
                )}
                <a href={`${fileUrl(file.id)}?download=1`} className="btno">
                  {t.download}
                </a>
                {editable && (
                  <ConfirmDeleteButton
                    action={deleteProjectFileAction}
                    fields={{ id: file.id }}
                    confirmMessage={t.confirmDelete(file.name)}
                    label={t.delete}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <PreviewOverlay
          file={preview}
          files={previewable}
          onSelect={setPreviewId}
          onClose={() => setPreviewId(null)}
          t={t}
        />
      )}
    </div>
  );
}

function UploadZone({ projectId, t }: { projectId: string; t: T }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  async function upload(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0 || progress) return;
    const failed: string[] = [];
    for (const [i, file] of picked.entries()) {
      setProgress({ done: i + 1, total: picked.length });
      if (file.size > MAX_PROJECT_FILE_MB * 1024 * 1024) {
        failed.push(t.tooLarge(file.name, MAX_PROJECT_FILE_MB));
        continue;
      }
      const body = new FormData();
      body.set("projectId", projectId);
      body.set("file", file);
      const res = await fetch("/api/uploads/project-files", { method: "POST", body }).catch(() => null);
      if (!res?.ok) failed.push(t.uploadFailed(file.name));
    }
    setProgress(null);
    setErrors(failed);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload(e.dataTransfer.files);
      }}
      className={`card p-4 flex items-center justify-between gap-3 flex-wrap ${dragging ? "!border-accent" : ""}`}
    >
      <div>
        <p className="text-[12px] placeholder-text">{progress ? t.uploading(progress.done, progress.total) : t.dropHint(MAX_PROJECT_FILE_MB)}</p>
        {errors.map((error) => (
          <p key={error} className="text-[12px] text-warning mt-1">
            {error}
          </p>
        ))}
      </div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <button type="button" className="btn" disabled={Boolean(progress)} onClick={() => inputRef.current?.click()}>
        {t.upload}
      </button>
    </div>
  );
}

function PreviewOverlay({
  file,
  files,
  onSelect,
  onClose,
  t,
}: {
  file: FileRow;
  files: FileRow[];
  onSelect: (id: string) => void;
  onClose: () => void;
  t: T;
}) {
  const index = files.findIndex((f) => f.id === file.id);
  const previous = files[index - 1];
  const next = files[index + 1];
  const kind = previewOf(file.name)?.kind;
  const office = kind === "word" || kind === "sheet";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && previous) onSelect(previous.id);
      if (e.key === "ArrowRight" && next) onSelect(next.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, previous, next]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={file.name}>
      <div className="flex items-center gap-2 p-3 border-b border-ink/20">
        <div className="text-sm font-semibold min-w-0 flex-1 truncate">{file.name}</div>
        <button type="button" className="btno" disabled={!previous} aria-label={t.previous} onClick={() => previous && onSelect(previous.id)}>
          ←
        </button>
        <button type="button" className="btno" disabled={!next} aria-label={t.next} onClick={() => next && onSelect(next.id)}>
          →
        </button>
        <a href={`${fileUrl(file.id)}?download=1`} className="btno">
          {t.download}
        </a>
        <button type="button" className="btno" onClick={onClose}>
          {t.close}
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- an authenticated upload, not a static asset.
          <img src={fileUrl(file.id)} alt={file.name} className="max-w-full max-h-full object-contain" />
        ) : (
          <iframe
            key={file.id}
            src={office ? `${fileUrl(file.id)}/preview` : fileUrl(file.id)}
            title={file.name}
            className={`w-full h-full border-0 ${kind === "text" ? "bg-white" : ""}`}
          />
        )}
      </div>
    </div>
  );
}
