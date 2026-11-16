import type { View } from "./types";

const ALLOWED: ReadonlySet<View> = new Set([
  "overview", "companies", "products", "procurements",
  "courts", "relations", "sources", "imports", "dossier",
]);

/** Links can open a specific screen without bypassing auth or loading cloud data. */
export function initialViewFromSearch(search: string): View {
  try {
    const raw = new URLSearchParams(search).get("view");
    if (raw && ALLOWED.has(raw as View)) return raw as View;
  } catch {
    // Invalid input falls back to the public landing screen.
  }
  return "overview";
}
