"use client";

export function ConfirmDeleteButton({
  action,
  fields,
  confirmMessage,
  label = "Delete",
  className = "btno !border-accent text-accent",
}: {
  action: (formData: FormData) => void;
  fields: Record<string, string>;
  confirmMessage: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
