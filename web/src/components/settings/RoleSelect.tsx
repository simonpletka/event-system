const BUILT_IN_ROLES = [
  { value: "ROLE:ADMIN", label: "Admin" },
  { value: "ROLE:ACCOUNTANT", label: "Accountant" },
  { value: "ROLE:PRODUCER", label: "Producer" },
  { value: "ROLE:MEMBER", label: "Member" },
];

export function RoleSelect({
  name,
  defaultValue,
  customRoles,
  className,
  disabled,
  onChange,
}: {
  name: string;
  defaultValue: string;
  customRoles: { id: string; name: string }[];
  className?: string;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <select name={name} defaultValue={defaultValue} disabled={disabled} onChange={onChange} className={className}>
      <optgroup label="Built-in">
        {BUILT_IN_ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </optgroup>
      {customRoles.length > 0 && (
        <optgroup label="Custom">
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
