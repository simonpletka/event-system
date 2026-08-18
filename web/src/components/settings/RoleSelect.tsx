import type { Dictionary } from "@/lib/i18n";

type TRoles = Dictionary["roles"];
type T = Dictionary["settings"]["roleSelect"];

export function RoleSelect({
  name,
  defaultValue,
  customRoles,
  className,
  disabled,
  onChange,
  t,
  tRoles,
}: {
  name: string;
  defaultValue: string;
  customRoles: { id: string; name: string }[];
  className?: string;
  disabled?: boolean;
  onChange?: () => void;
  t: T;
  tRoles: TRoles;
}) {
  const builtInRoles = [
    { value: "ROLE:ADMIN", label: tRoles.ADMIN },
    { value: "ROLE:ACCOUNTANT", label: tRoles.ACCOUNTANT },
    { value: "ROLE:PRODUCER", label: tRoles.PRODUCER },
    { value: "ROLE:MEMBER", label: tRoles.MEMBER },
  ];

  return (
    <select name={name} defaultValue={defaultValue} disabled={disabled} onChange={onChange} className={className}>
      <optgroup label={t.builtInGroup}>
        {builtInRoles.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </optgroup>
      {customRoles.length > 0 && (
        <optgroup label={t.customGroup}>
          {customRoles.map((r) => (
            <option key={r.id} value={`CUSTOM:${r.id}`}>
              {r.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
