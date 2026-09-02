"use client";

import { useState } from "react";
import { QuickCreateProjectModal } from "@/components/QuickCreateProjectModal";
import type { Dictionary } from "@/lib/dictionary";

export type PickableProject = { id: string; title: string; companyName: string; quotedValue?: number };

type T = Dictionary["projects"]["picker"];

export function ProjectPicker({
  name,
  initialEvents,
  defaultValue,
  required,
  extraOption,
  onSelect,
  t,
}: {
  name: string;
  initialEvents: PickableProject[];
  defaultValue?: string;
  required?: boolean;
  /** e.g. Expenses' "Company overhead — not tied to a project" option, shown above the project list. */
  extraOption?: { value: string; label: string };
  /** Fired whenever the selected project id changes (incl. right after a quick-create). */
  onSelect?: (projectId: string) => void;
  t: T;
}) {
  const [projects, setProjects] = useState(initialEvents);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [modalOpen, setModalOpen] = useState(false);

  function select(id: string) {
    setSelected(id);
    onSelect?.(id);
  }

  return (
    <div className="flex gap-1.5">
      <select
        name={name}
        value={selected}
        onChange={(e) => select(e.target.value)}
        required={required}
        className="input flex-1"
      >
        {!extraOption && (
          <option value="" disabled>
            {t.selectProject}
          </option>
        )}
        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
        {projects.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} — {e.companyName}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setModalOpen(true)} className="btno font-semibold text-[9px] whitespace-nowrap">
        {t.newProjectBtn}
      </button>
      {modalOpen && (
        <QuickCreateProjectModal
          onClose={() => setModalOpen(false)}
          onCreated={(project) => {
            setProjects((prev) => [...prev, project]);
            select(project.id);
            setModalOpen(false);
          }}
          t={t}
        />
      )}
    </div>
  );
}
