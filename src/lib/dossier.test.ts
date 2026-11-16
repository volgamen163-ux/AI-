import { describe,expect,it } from "vitest";
import { DEMO } from "./demo";
import { buildDossier,dossierCsv } from "./dossier";
describe("company dossier scoped records",()=>{
 it("does not mix companies or offers",()=>{
  const d=buildDossier(DEMO,"demo-a",true);
  expect(d?.products.map(x=>x.product.id)).toEqual(["dp1"]);
  expect(d?.products[0].offers).toHaveLength(3);
  expect(d?.courts).toHaveLength(0);
 });
 it("counts events separately and marks demo",()=>{
  const d=buildDossier(DEMO,"demo-a",true);
  expect(d).toMatchObject({participation:1,wins:0,contracts:1,contractValue:81000,isDemo:true});
 });
 it("does not count demo as real by default",()=>{
  expect(buildDossier(DEMO,"demo-a")?.procurements).toHaveLength(0);
 });
 it("uses only comparable RUB market offers",()=>{
  expect(buildDossier(DEMO,"demo-a",true)?.products[0].medianRub).toBe(2100);
 });
 it("does not invent records for missing firms",()=>{
  expect(buildDossier(DEMO,"unknown")).toBeNull();
 });
 it("exports evidence, caveats and formula-safe values",()=>{
  const d=buildDossier(DEMO,"demo-a",true)!;
  const report=dossierCsv(d);
  expect(report).toContain("Договор не доказывает победу");
  expect(report).toContain("Вымышленные учебные данные");
  const bad=buildDossier({...DEMO,companies:[{...DEMO.companies[0],name:"=HYPERLINK(1)"}]},"demo-a",true)!;
  expect(dossierCsv(bad)).toContain("'=HYPERLINK(1)");
 });
});
