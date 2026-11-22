"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStudioWorkAction, deleteStudioWorkAction } from "@/lib/actions/studio";
import { studioApp, type StudioAppSlug } from "@/lib/studio";
import { exportFromApp, loadIntoApp, prepareStorage, readFromApp } from "@/lib/studio-bridge";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatPragueDate } from "@/lib/prague-date";
import { getDictionary, type Locale } from "@/lib/dictionary";

type Work = { id: string; title: string; projectId: string | null; data: string; updatedAt: string; editable: boolean };

/**
 * One Studio app in a frame, with a toolbar to name the work, link it to a
 * project, save it and switch to other saved work. Opening another work
 * navigates with ?work=, which remounts this component (keyed by the page),
 * so every app starts clean from the work it's given.
 */
export function StudioHost({
  slug,
  locale,
  works,
  projects,
  work,
  startNew,
  initialProjectId,
}: {
  slug: StudioAppSlug;
  locale: Locale;
  works: { id: string; title: string; project: string | null; updatedAt: string }[];
  projects: { id: string; label: string }[];
  work: Work | null;
  startNew: boolean;
  initialProjectId: string | null;
}) {
  const app = studioApp(slug)!;
  const t = getDictionary(locale).studio;
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Work still to be handed to the app once its frame has loaded ("global" apps only).
  const pendingRef = useRef<string | null>(null);
  const loadedRef = useRef(false);

  const [workId, setWorkId] = useState(work?.id ?? null);
  const [editable, setEditable] = useState(work?.editable ?? true);
  const [title, setTitle] = useState(work?.title ?? "");
  const [projectId, setProjectId] = useState(work?.projectId ?? initialProjectId ?? "");
  const [savedAt, setSavedAt] = useState(work?.updatedAt ?? null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Kept here so a save shows up at once; a page refresh would reset the address and reload the app.
  const [savedWorks, setSavedWorks] = useState(works);
  const [pending, startTransition] = useTransition();
  const [exiting, setExiting] = useState(false);

  /** Starts the app: storage apps read their keys on start, so those are filled first. */
  function startApp(data: string | null | undefined) {
    const frame = frameRef.current;
    if (!frame) return;
    prepareStorage(app, data);
    pendingRef.current = app.kind === "global" && data ? data : null;
    loadedRef.current = false;
    frame.src = `/studio-app/${app.slug}?v=${Date.now()}`;
  }

  // The frame gets its address only here, after the saved work is in place;
  // set during render it would start loading before that.
  useEffect(() => {
    startApp(work ? work.data : startNew ? null : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount; the page remounts this for other work.
  }, []);

  // The address follows the open work, so a reload or a shared link reopens it.
  // Set after every render: the save's own refresh puts back the old address.
  useEffect(() => {
    const want = workId ? `?work=${workId}` : "";
    if (window.location.search !== want) window.history.replaceState(window.history.state, "", `/studio/${app.slug}${want}`);
  });

  useEffect(() => {
    if (!message?.ok) return;
    const id = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(id);
  }, [message]);

  async function onFrameLoad() {
    const frame = frameRef.current;
    if (!frame?.contentWindow || !frame.src) return;
    const data = pendingRef.current;
    pendingRef.current = null;
    if (data) {
      try {
        await loadIntoApp(app, frame.contentWindow, data);
      } catch {
        setMessage({ ok: false, text: t.openFailed });
      }
    }
    loadedRef.current = true;
  }

  /** Saves the app's work; resolves to whether it was saved. */
  function save(asNew: boolean): Promise<boolean> {
    const frame = frameRef.current?.contentWindow;
    if (!frame || !loadedRef.current) {
      setMessage({ ok: false, text: t.appNotReady });
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const read = await readFromApp(app, frame);
          const finalTitle = title.trim() || read.title || t.untitled;
          const formData = new FormData();
          if (workId && !asNew) formData.set("id", workId);
          formData.set("app", app.slug);
          formData.set("title", finalTitle);
          formData.set("projectId", projectId);
          formData.set("data", read.data);
          const result = await saveStudioWorkAction(formData);
          if (!result.ok || !result.id) {
            setMessage({ ok: false, text: t.saveFailed(result.error ?? "") });
            resolve(false);
            return;
          }
          setWorkId(result.id);
          setEditable(true);
          setTitle(finalTitle);
          setSavedAt(new Date().toISOString());
          setMessage({ ok: true, text: t.saved });
          const entry = {
            id: result.id,
            title: finalTitle,
            project: projects.find((p) => p.id === projectId)?.label ?? null,
            updatedAt: new Date().toISOString(),
          };
          setSavedWorks((list) => [entry, ...list.filter((w) => w.id !== result.id)]);
          resolve(true);
        } catch (e) {
          setMessage({ ok: false, text: t.saveFailed(e instanceof Error ? e.message : "") });
          resolve(false);
        }
      });
    });
  }

  function exportFile() {
    const frame = frameRef.current?.contentWindow;
    if (!frame || !loadedRef.current) return setMessage({ ok: false, text: t.appNotReady });
    setMessage(exportFromApp(app, frame) ? { ok: true, text: t.exported } : { ok: false, text: t.exportMissing });
  }

  async function saveAndExit() {
    if (await save(!editable)) router.push("/studio");
    else setExiting(false);
  }

  function startEmpty() {
    setWorkId(null);
    setEditable(true);
    setTitle("");
    setSavedAt(null);
    setMessage(null);
    startApp(null);
  }

  const name = t.apps[app.slug].name;
  const control = "input !py-1.5 !text-[12px] h-8";
  return (
    <div className="flex flex-col gap-2 h-[calc(100dvh-2.5rem)] -mt-1">
      <header className="glass-panel rounded-2xl px-2.5 py-2 flex flex-wrap items-center gap-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
        <button type="button" className="btno !py-1.5 inline-flex items-center gap-1.5" onClick={() => setExiting(true)}>
          <span aria-hidden>←</span>
          {t.exit}
        </button>
        <h1 className="text-[15px] font-bold tracking-tight px-1">{name}</h1>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.titlePlaceholder}
          aria-label={t.workTitle}
          className={`${control} min-w-[160px] flex-1 max-w-[280px]`}
        />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t.project} className={`${control} max-w-[240px]`}>
          <option value="">{t.noProject}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {editable && (
            <button type="button" className="btn !py-1.5" disabled={pending} onClick={() => save(false)}>
              {pending ? t.saving : t.save}
            </button>
          )}
          {workId && (
            <button type="button" className="btno !py-1.5" disabled={pending} onClick={() => save(true)}>
              {t.saveAsNew}
            </button>
          )}
          <button type="button" className="btno !py-1.5" title={t.newHint} onClick={startEmpty}>
            {t.newWork}
          </button>
          {workId && editable && (
            <ConfirmDeleteButton
              action={deleteStudioWorkAction}
              fields={{ id: workId }}
              confirmMessage={t.confirmDelete(title || t.untitled)}
              label={t.delete}
              className="btno !py-1.5 !text-warning !border-warning/40"
            />
          )}
        </div>
        <span className="text-[11px] placeholder-text">
          {savedAt ? t.savedAt(formatPragueDate(savedAt, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : t.notSavedYet}
          {!editable && ` · ${t.readOnly}`}
        </span>
        {message && (
          <span role="status" className={`text-[11px] ${message.ok ? "text-positive" : "text-warning"}`}>
            {message.text}
          </span>
        )}
        <select
          value=""
          onChange={(e) => e.target.value && router.push(`/studio/${app.slug}?work=${e.target.value}`)}
          aria-label={t.openSaved}
          className={`${control} max-w-[240px] ml-auto`}
        >
          <option value="">{t.openSaved}</option>
          {savedWorks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.project ? `${w.title} · ${w.project}` : w.title}
            </option>
          ))}
        </select>
      </header>
      <iframe ref={frameRef} onLoad={onFrameLoad} title={name} className="w-full flex-1 min-h-0 rounded-[18px] border border-ink/12 bg-bg" />

      {exiting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm p-4" role="presentation" onClick={() => setExiting(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="studio-exit-title"
            className="glass-panel rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setExiting(false)}
          >
            <div id="studio-exit-title" className="text-[15px] font-bold mb-2">
              {t.exitTitle}
            </div>
            <p className="text-[13px] leading-relaxed text-ink/85">{t.exitBody}</p>
            <div className="flex flex-col gap-2 mt-5">
              <button type="button" className="btn" autoFocus disabled={pending} onClick={saveAndExit}>
                {pending ? t.saving : editable ? t.saveAndExit : t.saveAsNewAndExit}
              </button>
              <button type="button" className="btno" onClick={exportFile}>
                {t.exportFile}
              </button>
              <button type="button" className="btno !text-warning !border-warning/40" onClick={() => router.push("/studio")}>
                {t.exitWithoutSaving}
              </button>
              <button type="button" className="btno !border-transparent" onClick={() => setExiting(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
