import { describe, expect, it } from "vitest";
import { dateLabel } from "./validation";

describe("date formatting across timezones", () => {
  it("keeps EIS date-only records on their actual calendar day", () => {
    expect(dateLabel("2026-10-12")).toBe("12.10.2026");
    expect(dateLabel("2026-10-28")).toBe("28.10.2026");
  });
  it("formats timestamps consistently in UTC", () => {
    expect(dateLabel("2026-10-12T00:00:00Z")).toBe("12.10.2026");
  });
  it("rejects malformed dates and impossible calendar days", () => {
    expect(dateLabel("2026-02-30")).toBe("Некорректная дата");
    expect(dateLabel("garbled")).toBe("Некорректная дата");
  });
  it("labels absent dates honestly", () => {
    expect(dateLabel(null)).toBe("Не указана");
    expect(dateLabel("")).toBe("Не указана");
  });
});
