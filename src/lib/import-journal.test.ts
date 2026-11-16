import { describe, expect, it, vi } from "vitest";
import { auditedImport, type ImportAdapter } from "./import-journal";
const sample = [{ kind: "company" as const, row: { inn: "7707083893" } }, { kind: "company" as const, row: { inn: "7702070139" } }];
function mock(): ImportAdapter {
  return { start: vi.fn(async () => "job-1"), insert: vi.fn(async () => {}), finish: vi.fn(async () => {}) };
}
describe("CSV/XML import journal", () => {
  it("tracks saved rows and validation errors", async () => {
    const db = mock();
    const result = await auditedImport(sample, ["invalid INN"], 3, db);
    expect(result.counters).toEqual({ total: 3, valid: 2, rejected: 1, inserted: 2, failed: 0 });
    expect(result.status).toBe("complete");
    expect(db.start).toHaveBeenCalledTimes(1);
    expect(db.finish).toHaveBeenCalledTimes(1);
  });
  it("preserves partial success, reports failed write", async () => {
    const db = mock(); let calls = 0;
    db.insert = async () => { if (++calls === 2) throw Error("duplicate key"); };
    const result = await auditedImport(sample, [], 2, db);
    expect(result.counters).toMatchObject({ inserted: 1, failed: 1 });
    expect(result.status).toBe("failed");
  });
  it("never writes entities when journal creation fails", async () => {
    const db = mock(); db.start = async () => { throw Error("RLS denied"); };
    await expect(auditedImport(sample, [], 2, db)).rejects.toThrow("RLS denied");
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("reports journal-finalization errors", async () => {
    const db = mock(); db.finish = async () => { throw Error("timeout"); };
    const result = await auditedImport(sample, [], 2, db);
    expect(result.journalError).toContain("timeout");
  });
  it("rejects empty uploads without starting a job", async () => {
    const db = mock();
    await expect(auditedImport([], [], 0, db)).rejects.toThrow("Нет допустимых");
    expect(db.start).not.toHaveBeenCalled();
  });
});
