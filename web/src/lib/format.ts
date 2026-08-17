export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", opts).format(date);
}

export function formatDateRange(start: Date, end: Date) {
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return formatDate(start);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toDateTimeLocal(date: Date | null | undefined) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
