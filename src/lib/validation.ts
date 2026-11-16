export function validInn(value: string): boolean {
  const s = value.trim();
  if (!/^(?:\d{10}|\d{12})$/.test(s)) return false;
  const n = [...s].map(Number);
  const mod = (w: number[]) => w.reduce((a, v, i) => a + v * n[i], 0) % 11 % 10;
  return n.length === 10
    ? mod([2,4,10,3,5,9,4,6,8]) === n[9]
    : mod([7,2,4,10,3,5,9,4,6,8]) === n[10] && mod([3,7,2,4,10,3,5,9,4,6,8]) === n[11];
}
export function safeHttpUrl(s?: string | null): string | null {
  if (!s) return null;
  try {
    const url = new URL(s);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}
export const currency = (v: number, code = "RUB") => new Intl.NumberFormat("ru-RU", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(v);
export function dateLabel(v?: string | null): string {
  if (!v) return "Не указана";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const numericYear = Number(year), numericMonth = Number(month), numericDay = Number(day);
    const dt = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
    if (
      dt.getUTCFullYear() !== numericYear ||
      dt.getUTCMonth() + 1 !== numericMonth ||
      dt.getUTCDate() !== numericDay
    ) return "Некорректная дата";
    return day + "." + month + "." + year;
  }
  const timestamp = new Date(v);
  if (Number.isNaN(timestamp.getTime())) return "Некорректная дата";
  return timestamp.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}
export const norm = (s?: string | null) => String(s || "").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[\s"«»]/g,"").trim();
export function escapeCsv(value: unknown): string {
  let s = String(value == null ? "" : value);
  if (/^[\u0000-\u0020]*[=+@\-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function toCsv(headers: string[], rows: unknown[][]): string {
  return "\ufeff" + [headers, ...rows].map(row => row.map(escapeCsv).join(";")).join("\r\n");
}
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
