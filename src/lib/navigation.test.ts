import { describe, expect, it } from "vitest";
import { initialViewFromSearch } from "./navigation";

describe("safe NEXUS analytics deep links", () => {
  it("opens the live integrations screen", () => {
    expect(initialViewFromSearch("?view=sources")).toBe("sources");
  });
  it("opens the unified import screen", () => {
    expect(initialViewFromSearch("?view=imports")).toBe("imports");
  });
  it("rejects unknown routes", () => {
    expect(initialViewFromSearch("?view=admin")).toBe("overview");
  });
  it("does not accept injected route values", () => {
    expect(initialViewFromSearch("?view=%3Cscript%3E")).toBe("overview");
  });
  it("defaults to home without a query", () => {
    expect(initialViewFromSearch("")).toBe("overview");
  });
});
