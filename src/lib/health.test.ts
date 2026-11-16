import { describe, expect, it } from "vitest";
import { runProbes } from "./health";

describe("infrastructure live checks", () => {
  it("passes only fulfilled probes", async () => {
    const r = await runProbes([
      { id: "a", name: "A", check: async () => "connected" },
      { id: "b", name: "B", check: async () => { throw new Error("API unreachable"); } },
    ]);
    expect(r.map((x) => x.status)).toEqual(["ok", "error"]);
    expect(r[0].detail).toBe("connected");
  });
  it("fails unresolved checks when timeout elapses", async () => {
    const r = await runProbes([
      { id: "never", name: "Never", check: () => new Promise<string>(() => {}) },
    ], 15);
    expect(r[0].status).toBe("error");
    expect(r[0].detail).toContain("ожидания");
  });
  it("escapes no state and clamps error details", async () => {
    const r = await runProbes([
      { id: "big", name: "Big", check: async () => { throw new Error("Z".repeat(300)); } },
    ]);
    expect(r[0].detail.length).toBeLessThanOrEqual(150);
  });
  it("runs probes sequentially to respect provider limits", async () => {
    const calls: string[] = [];
    await runProbes([
      { id: "first", name: "First", check: async () => { calls.push("first"); return "1"; } },
      { id: "second", name: "Second", check: async () => { calls.push("second"); return "2"; } },
    ]);
    expect(calls).toEqual(["first", "second"]);
  });
});
