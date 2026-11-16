import { describe,expect,it } from "vitest";
import { blankAccess, isRequestStatus, normalizeAccess, validateReference, SOURCES } from "./source-access";

describe("official source-access request tracking",()=>{
 it("creates independent records for three registries",()=>{
  const entries=blankAccess();
  expect(Object.keys(entries)).toHaveLength(3);
  expect(Object.values(entries).every(x=>x.request_status==="not_started")).toBe(true);
  expect(SOURCES.map(x=>x.id)).toEqual(["fns_bulk","eis_soi","kad_provider"]);
 });
 it("validates progress and rejects invented status",()=>{
  expect(isRequestStatus("submitted")).toBe(true);
  expect(isRequestStatus("api_connected")).toBe(false);
 });
 it("does not turn unrecognized records into approved requests",()=>{
  const items=normalizeAccess([{source_id:"fns_bulk",request_status:"access_issued",reference_number:"№ 123"},
    {source_id:"unrecognized",request_status:"access_issued",reference_number:"fake"},
    {source_id:"kad_provider",request_status:"connected",reference_number:"fake"}]);
  expect(items.fns_bulk.request_status).toBe("access_issued");
  expect(items.kad_provider.request_status).toBe("not_started");
 });
 it("prevents accidental secret-like values in request references",()=>{
  expect(()=>validateReference("api_key:SUPERSECRET")).toThrow();
  expect(()=>validateReference("password=1234")).toThrow();
  expect(()=>validateReference("X".repeat(121))).toThrow();
  expect(validateReference(" № 5678/2026 ")).toBe("№ 5678/2026");
 });
});
