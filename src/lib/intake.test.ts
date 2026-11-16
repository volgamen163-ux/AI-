import { describe,it,expect } from "vitest";
import { prepareXmlImport } from "./intake";
import { DEMO } from "./demo";
import type { ImportPreview } from "../types";
import type { Workspace } from "./types";

const workspace:Workspace={...DEMO,companies:[{...DEMO.companies[0],inn:"7707083893"}]};
function preview(type:ImportPreview["type"],items:Record<string,unknown>[]):ImportPreview{
 return {type,filename:"sample.xml",items,errors:[],total:items.length,info:"УЧЕБНЫЙ XML"};
}
describe("NEXUS XML to normalized ingestion contract",()=>{
 it("preserves unverified status from synthetic EGRUL XML",()=>{
  const r=prepareXmlImport(preview("companies",[{inn:"7702070139",name:"Тестовая организация",ogrn:"1027739609391"}]),workspace);
  expect(r.errors).toEqual([]);
  expect(r.valid[0].row).toMatchObject({inn:"7702070139",source_provider:"xml_upload",verification_status:"unverified"});
 });
 it("requires known supplier INN for contract XML",()=>{
  const r=prepareXmlImport(preview("tenders",[{companyInn:"7728168971",procedure_number:"DEMO-001",event_type:"contract"}]),workspace);
  expect(r.valid).toHaveLength(0);expect(r.errors[0]).toContain("Сначала импортируйте компанию");
 });
 it("never treats XML contract as confirmed win",()=>{
  const r=prepareXmlImport(preview("tenders",[{companyInn:"7707083893",procedure_number:"DEMO-001",event_type:"contract",law:"223-FZ",amount:1000}]),workspace);
  expect(r.valid).toHaveLength(1);
  expect(r.valid[0].row).toMatchObject({event_type:"contract",verification_status:"unverified",law:"223-FZ",is_demo:false});
 });
 it("blocks malformed source URLs",()=>{
  const r=prepareXmlImport(preview("companies",[{inn:"7702070139",name:"Тестовая организация",source_url:"javascript:alert(1)"}]),workspace);
  expect(r.valid).toHaveLength(0);expect(r.errors[0]).toContain("ссылка");
 });
 it("deduplicates company INNs inside one XML",()=>{
  const r=prepareXmlImport(preview("companies",[{inn:"7702070139",name:"Тестовая организация"},{inn:"7702070139",name:"Другая компания"}]),workspace);
  expect(r.valid).toHaveLength(1);expect(r.errors).toHaveLength(1);
 });
});
