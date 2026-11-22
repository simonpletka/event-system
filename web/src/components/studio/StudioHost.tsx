"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStudioWorkAction, deleteStudioWorkAction } from "@/lib/actions/studio";
import { studioApp, type StudioAppSlug } from "@/lib/studio";
import { loadIntoApp, prepareStorage, readFromApp } from "@/lib/studio-bridge";
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

  function save(asNew: boolean) {
    const frame = frameRef.current?.contentWindow;
    if (!frame || !loadedRef.current) {
      setMessage({ ok: false, text: t.appNotReady });
      return;
    }
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
      } catch (e) {
        setMessage({ ok: false, text: t.saveFailed(e instanceof Error ? e.message : "") });
      }
    });
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
  return (
    <div className="flex flex-col gap-3 -mt-1">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="text-[22px] font-bold tracking-tight mr-2 self-center">{name}</h1>
        <label className="flex flex-col gap-1 min-w-[180px] flex-1 max-w-[320px]">
          <span className="field-label">{t.workTitle}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} className="input !py-1.5 text-[13px]" />
        </label>
        <label className="flex flex-col gap-1 min-w-[160px] max-w-[260px]">
          <span className="field-label">{t.project}</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input !py-1.5 text-[13px]">
            <option value="">{t.noProject}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {editable && (
            <button type="button" className="btn" disabled={pending} onClick={() => save(false)}>
              {pending ? t.saving : t.save}
            </button>
          )}
          {workId && (
            <button type="button" className="btno" disabled={pending} onClick={() => save(true)}>
              {t.saveAsNew}
            </button>
          )}
          <button type="button" className="btno" title={t.newHint} onClick={startEmpty}>
            {t.newWork}
          </button>
          {workId && editable && (
            <ConfirmDeleteButton action={deleteStudioWorkAction} fields={{ id: workId }} confirmMessage={t.confirmDelete(title || t.untitled)} label={t.delete} />
          )}
        </div>
        <select
          value=""
          onChange={(e) => e.target.value && router.push(`/studio/${app.slug}?work=${e.target.value}`)}
          aria-label={t.openSaved}
          className="input !py-1.5 text-[13px] max-w-[260px] ml-auto"
        >
          <option value="">{t.openSaved}</option>
          {savedWorks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.project ? `${w.title} · ${w.project}` : w.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3 text-[11px] placeholder-text min-h-4">
        <span>{savedAt ? t.savedAt(formatPragueDate(savedAt, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : t.notSavedYet}</span>
        {!editable && <span>{t.readOnly}</span>}
        {message && (
          <span role="status" className={message.ok ? "text-positive" : "text-warning"}>
            {message.text}
          </span>
        )}
      </div>
      <iframe
        ref={frameRef}
        onLoad={onFrameLoad}
        title={name}
        className="w-full rounded-[18px] border border-ink/12 bg-bg h-[calc(100dvh-150px)] min-h-[520px]"
      />
    </div>
  );
}
