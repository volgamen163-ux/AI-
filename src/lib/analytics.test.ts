import { describe, expect, it } from "vitest";
import { companyScope, courtSummary, median, money, procurementSummary, productInsight, relationSignals, safeUrl, statistics, validInn } from "./analytics";
import type { Workspace, Product, Relation, Company } from "../types";

describe("data quality and mathematical invariants", () => {
  it("verifies INN checksums and rejects malformed identifiers", () => {
    expect(validInn("7707083893")).toBe(true);
    expect(validInn("7702070139")).toBe(true);
    expect(validInn("7707083892")).toBe(false);
    expect(validInn("demo")).toBe(false);
  });
  it("refuses javascript and data links", () => {
    expect(safeUrl("javascript:alert(1)")).toBe(null);
    expect(safeUrl("data:text/plain,a")).toBe(null);
    expect(safeUrl("https://egrul.nalog.gov.ru/")).toContain("https://");
  });
  it("calculates median without treating missing data as zero", () => {
    expect(median([])).toBe(null);
    expect(median([10, 12, 100])).toBe(12);
    expect(median([4, 8])).toBe(6);
    expect(money(null)).toBe("Не указано");
  });
  const base: Workspace = { companies: [], products: [], tenders: [
    {id:"a",user_id:"u",company_id:"c",procedure_number:"X",customer:"C",event_type:"participation",law:"223-FZ",amount:1000,occurred_at:null,source_url:null,source_provider:"csv",verification_status:"unverified",is_demo:false},
    {id:"b",user_id:"u",company_id:"c",procedure_number:"X",customer:"C",event_type:"contract",law:"223-FZ",amount:900,occurred_at:null,source_url:null,source_provider:"csv",verification_status:"unverified",is_demo:false},
    {id:"demo",user_id:"u",company_id:"c",procedure_number:"D",customer:"C",event_type:"win",law:"223-FZ",amount:9000,occurred_at:null,source_url:null,source_provider:"demo",verification_status:"unverified",is_demo:true},
  ], cases: [], offers: [], relations: [] };
  it("separates participation, declared wins and contracts", () => {
    expect(procurementSummary(base.tenders)).toEqual({ participation: 1, wins: 0, contracts: 1, totalContracts: 900 });
    expect(statistics(base).contractSum).toBe(900);
  });
  it("does not infer liabilities from lawsuits or process roles", () => {
    const rows = [{id:"1",user_id:"u",company_id:"c",case_number:"A40",court_name:"court",role:"defendant" as const,stage:"filed",claim_amount:10000,filed_at:null,source_url:null,source_provider:"csv",verification_status:"unverified" as const,is_demo:false}];
    expect(courtSummary(rows).defendant).toBe(1);
    expect(courtSummary(rows).claimAmount).toBe(10000);
  });
  it("reports only observed product offers and their availability", () => {
    const product = {id:"p"} as Product;
    const rows = [ {product_id:"p",unit_price:100,currency:"RUB",stock_status:"in_stock"}, {product_id:"p",unit_price:300,currency:"RUB",stock_status:"unknown"}, {product_id:"p",unit_price:10,currency:"USD",stock_status:"in_stock"} ];
    const result = productInsight(product,rows as never);
    expect(result).toMatchObject({sampleSize:2,minimum:100,median:200,inStock:1});
  });
  it("never promotes relation signals to established affiliation", () => {
    const companies=[{id:"a",name:"A"},{id:"b",name:"B"}] as Company[];
    const links=[{id:"x",company_a:"a",company_b:"b",signal_type:"address"}] as Relation[];
    expect(relationSignals(links,companies)[0]?.conclusion).toContain("не юридическое доказательство");
  });
  it("scopes related records to one company", () => {
    expect(companyScope(base,"c").tenders).toHaveLength(2);
    expect(companyScope(base,"unknown").tenders).toHaveLength(0);
  });
});
