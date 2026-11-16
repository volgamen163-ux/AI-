import { describe,it,expect } from "vitest";
import { procurementMetrics, marketStats, automaticSignals, summary } from "./analytics";
import { validInn, safeHttpUrl, escapeCsv } from "./validation";
import { DEMO } from "./demo";
describe("NEXUS data contracts",()=>{
 it("checks verified INN checksums",()=>{expect(validInn("7707083893")).toBe(true);expect(validInn("7707083892")).toBe(false);expect(validInn("ДЕМО-А")).toBe(false)});
 it("rejects dangerous source URLs",()=>{expect(safeHttpUrl("javascript:alert(1)")).toBe(null);expect(safeHttpUrl("https://egrul.nalog.gov.ru/")).toContain("https://")});
 it("distinguishes participation, wins and contracts",()=>{const p=procurementMetrics(DEMO.procurements.map(x=>({...x,is_demo:false})));expect(p.participation).toBe(1);expect(p.wins).toBe(0);expect(p.contracts).toBe(1);expect(p.contractValue).toBe(81000)});
 it("excludes demo contracts from real metrics",()=>{expect(procurementMetrics(DEMO.procurements).contracts).toBe(0)});
 it("computes median robustly",()=>{const a=marketStats(DEMO.offers.filter(x=>x.product_id==="dp1"));expect(a).toMatchObject({min:1750,median:2100,max:2400,count:3,inStock:1})});
 it("never invents market statistics",()=>{expect(marketStats([])).toBeNull()});
 it("treats matching directors as unverified signals",()=>{const s=automaticSignals(DEMO.companies);expect(s.some(x=>x.field==="director"&&x.verified===false)).toBe(true)});
 it("keeps fictional test data out of real procurement totals",()=>{expect(summary(DEMO).procurements).toBe(0)});
 it("sanitizes spreadsheet formula output",()=>{expect(escapeCsv("=2+2")).toMatch(/^"'/)});
});
