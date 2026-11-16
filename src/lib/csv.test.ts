import { describe,it,expect } from "vitest";
import { field, parseCsv } from "./csv";
describe("CSV importer",()=>{
 it("parses quoted separators",()=>{const r=parseCsv('Название;ИНН\n"ООО;Тест";7707083893');expect(r[0]["название"]).toBe("ООО;Тест")});
 it("supports BOM and CRLF",()=>{const r=parseCsv('\uFEFFname,inn\r\nTest,7707083893\r\n');expect(field(r[0],["inn"])).toBe("7707083893")});
 it("rejects unmatched quotes",()=>{expect(()=>parseCsv('a;b\n"open;abc')).toThrow()});
 it("limits rows",()=>{expect(()=>parseCsv('a\n1\n2',1)).toThrow()});
 it("rejects duplicate headers",()=>{expect(()=>parseCsv('a;a\n1;2')).toThrow()});
});
