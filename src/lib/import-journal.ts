import type { EntityKind } from "./types";
export type ImportEntry = { kind: EntityKind; row: Record<string, unknown> };
export type ImportCount = {
  total: number;
  valid: number;
  rejected: number;
  inserted: number;
  failed: number;
};
export type ImportResult = {
  id: string;
  counters: ImportCount;
  status: "complete" | "failed";
  errors: string[];
  journalError: string | null;
};
export type ImportAdapter = {
  start: (counters: ImportCount) => Promise<string>;
  insert: (item: ImportEntry) => Promise<void>;
  finish: (id: string, status: "complete" | "failed", counters: ImportCount, message: string | null) => Promise<void>;
};

/** Every data write requires a journal row; failure is recorded, not hidden. */
export async function auditedImport(
  entries: ImportEntry[],
  priorErrors: string[],
  total: number,
  adapter: ImportAdapter,
): Promise<ImportResult> {
  if (!entries.length) throw Error("Нет допустимых строк");
  if (entries.length > 500) throw Error("Превышен лимит 500 строк");
  const counters: ImportCount = { total, valid: entries.length, rejected: priorErrors.length, inserted: 0, failed: 0 };
  const id = await adapter.start({ ...counters });
  const errors = priorErrors.slice(0, 12);
  for (let n = 0; n < entries.length; n++) {
    try { await adapter.insert(entries[n]); counters.inserted++; }
    catch (e) {
      counters.failed++;
      if (errors.length < 12) errors.push("Строка " + (n + 1) + ": " + String(e instanceof Error ? e.message : e).slice(0, 140));
    }
  }
  const status: ImportResult["status"] = counters.failed ? "failed" : "complete";
  let journalError: string | null = null;
  try {
    await adapter.finish(id, status, counters, errors.length ? errors.join("; ").slice(0, 500) : null);
  } catch (e) { journalError = "Журнал не обновился: " + String(e instanceof Error ? e.message : e).slice(0, 140); }
  return { id, counters, status, errors, journalError };
}
