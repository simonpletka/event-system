"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";
import {
  createGearGroupAction,
  deleteGearGroupAction,
  setGearGroupItemAction,
  updateGearGroupAction,
  type GearFormState,
} from "@/lib/actions/gear";
import type { GearGroupView, GearTypeOption } from "@/lib/queries/gear";
import type { PickableProject } from "@/components/ProjectPicker";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { ReservePanel } from "./ReservePanel";
import { gearError } from "./CategoryManager";
import { PlusIcon } from "./shared";

function GroupForm({
  group,
  locale,
  onDone,
}: {
  group?: { id: string; name: string; description: string };
  locale: Locale;
  onDone?: () => void;
}) {
  const t = getDictionary(locale).gear;
  const [state, action, pending] = useActionState<GearFormState, FormData>(async (prev, fd) => {
    const result = group ? await updateGearGroupAction(prev, fd) : await createGearGroupAction(prev, fd);
    if (result.ok) onDone?.();
    return result;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {group && <input type="hidden" name="id" value={group.id} />}
      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.groupName}</span>
        <input name="name" defaultValue={group?.name} required className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.groupDescription}</span>
        <input name="description" defaultValue={group?.description} className="input" />
      </label>
      {state.error && <p className="text-[12px] text-warning">{gearError(t, state.error)}</p>}
      <button type="submit" disabled={pending} className="btn self-start">
        {group ? getDictionary(locale).common.save : t.createGroup}
      </button>
    </form>
  );
}

export function GroupsView({
  groups,
  selectedId,
  types,
  projects,
  initialProjectId,
  today,
  canManage,
  creating,
  locale,
}: {
  groups: GearGroupView[];
  selectedId: string | null;
  types: GearTypeOption[];
  projects: PickableProject[];
  initialProjectId?: string;
  today: string;
  canManage: boolean;
  creating: boolean;
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.gear;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = groups.find((g) => g.id === selectedId) ?? null;

  function setItem(typeId: string, quantity: number) {
    if (!selected) return;
    const fd = new FormData();
    fd.set("groupId", selected.id);
    fd.set("typeId", typeId);
    fd.set("quantity", String(quantity));
    startTransition(() => setGearGroupItemAction(fd));
  }

  const closeCreate = () => router.replace("/gear/groups", { scroll: false });
  const withProject = initialProjectId ? `&project=${initialProjectId}` : "";

  return (
    <div className="flex flex-wrap gap-4 md:gap-6 items-start">
      <nav aria-label={t.groups} className="card p-4 flex-[0_1_290px] min-w-[240px] w-full flex flex-col gap-1">
        <div className="heading-label px-1 pb-2">{t.groups}</div>
        {groups.length === 0 && <p className="text-[13px] placeholder-text px-1 pb-2">{canManage ? t.noGroupsManage : t.noGroups}</p>}
        {groups.map((g) => {
          const active = g.id === selected?.id;
          return (
            <Link
              key={g.id}
              href={`/gear/groups?group=${g.id}${withProject}`}
              scroll={false}
              aria-current={active ? "true" : undefined}
              onClick={() => setEditing(false)}
              className={`flex flex-col gap-0.5 px-3.5 py-3 rounded-2xl border ${active ? "bg-accent/15 border-accent/50" : "border-transparent hover:bg-ink/5"}`}
            >
              <span className="text-[15px] font-semibold">{g.name}</span>
              <span className="text-[12.5px] placeholder-text">{t.groupMeta(g.items.length, g.itemCount, formatCurrency(g.perDay))}</span>
            </Link>
          );
        })}
        {canManage && (
          <Link href="/gear/groups?new=1" scroll={false} className="btno self-start mt-3 inline-flex items-center gap-2">
            <PlusIcon /> {t.newGroup}
          </Link>
        )}
        <p className="text-[12.5px] leading-relaxed placeholder-text mt-3 px-1">{t.groupsHint}</p>
      </nav>

      {selected && (
        <section aria-label={selected.name} className="card p-5 md:p-6 flex-[1_1_340px] min-w-0 flex flex-col">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-bold tracking-tight">{selected.name}</h2>
              {selected.description && <p className="text-[13.5px] placeholder-text mt-1">{selected.description}</p>}
            </div>
            {canManage && (
              <button type="button" onClick={() => setEditing((v) => !v)} className="btno">
                {editing ? t.doneEditing : t.editGroup}
              </button>
            )}
          </div>

          {editing && (
            <div className="mt-4 p-4 rounded-2xl bg-ink/5 flex flex-col gap-4">
              <GroupForm key={selected.id} group={selected} locale={locale} />
              <ConfirmDeleteButton
                action={deleteGearGroupAction}
                fields={{ id: selected.id }}
                confirmMessage={t.deleteGroupConfirm(selected.name)}
                label={t.deleteGroup}
                pendingLabel={dict.common.deleting}
                className="btno self-start !border-warning text-warning"
              />
            </div>
          )}

          <ul className="mt-3" aria-busy={pending}>
            {selected.items.length === 0 && <li className="text-[13px] placeholder-text py-3">{t.emptyGroup}</li>}
            {selected.items.map((item) => (
              <li key={item.typeId} className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3.5 items-center py-3.5 border-t border-ink/10">
                <span className="grid place-items-center h-[34px] rounded-[10px] bg-ink/8 font-bold text-[14px] tabular-nums">{item.quantity}×</span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <Link href={`/gear/${item.typeId}`} className="text-[15px] font-semibold truncate hover:text-accent">
                    {item.name}
                  </Link>
                  <span className="text-[12.5px] placeholder-text">{item.category}</span>
                </span>
                {editing ? (
                  <span className="flex items-center gap-1">
                    <button type="button" disabled={pending} aria-label={`${t.decrease}: ${item.name}`} onClick={() => setItem(item.typeId, item.quantity - 1)} className="w-8 h-8 rounded-full border border-ink/16 hover:bg-ink/10">
                      −
                    </button>
                    <button type="button" disabled={pending} aria-label={`${t.increase}: ${item.name}`} onClick={() => setItem(item.typeId, item.quantity + 1)} className="w-8 h-8 rounded-full border border-ink/16 hover:bg-ink/10">
                      +
                    </button>
                    <button type="button" disabled={pending} onClick={() => setItem(item.typeId, 0)} className="text-[12px] text-warning px-2 hover:underline">
                      {t.remove}
                    </button>
                  </span>
                ) : (
                  <span className="text-[13.5px] placeholder-text tabular-nums">{formatCurrency(item.dayRate * item.quantity)}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex justify-between items-center pt-4 border-t border-ink/10">
            <span className="text-[13.5px] placeholder-text">{t.wholeGroupPerDay}</span>
            <span className="text-[18px] font-bold tabular-nums">{formatCurrency(selected.perDay)}</span>
          </div>

          {canManage && (
            <label className="flex items-center gap-2.5 mt-4 min-h-[46px] px-4 rounded-2xl border border-dashed border-ink/28 text-ink/60">
              <PlusIcon />
              <select
                value=""
                disabled={pending}
                onChange={(e) => {
                  const typeId = e.target.value;
                  if (!typeId) return;
                  const existing = selected.items.find((i) => i.typeId === typeId);
                  setItem(typeId, (existing?.quantity ?? 0) + 1);
                }}
                aria-label={t.addTypeToGroup}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink py-3"
              >
                <option value="">{t.addTypeToGroup}</option>
                {types.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.category} · {x.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {selected && (
        <section aria-label={t.reserveThisGroup} className="card p-5 md:p-6 flex-[1_1_380px] min-w-0">
          <ReservePanel
            title={t.reserveThisGroup}
            locale={locale}
            projects={projects}
            initialProjectId={initialProjectId}
            types={types}
            initialLines={selected.items.map((i) => ({ typeId: i.typeId, quantity: i.quantity }))}
            editableLines={false}
            groupId={selected.id}
            today={today}
            canReserve={canManage}
          />
        </section>
      )}

      {creating && canManage && (
        <Modal title={t.newGroup} onClose={closeCreate} closeLabel={dict.common.close}>
          <GroupForm locale={locale} />
        </Modal>
      )}
    </div>
  );
}
