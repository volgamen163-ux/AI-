import { describe, expect, it } from "vitest";
import { csvRows, fromCsv, sampleCsv } from "./importers";
describe("data intake provenance and validation",()=>{
  it("reads escaped quotes, semicolon and newlines",()=>{
    expect(csvRows('Название;ИНН\n"ООО ""Ромашка""; Север";7707083893')[0]).toMatchObject({название:'ООО "Ромашка"; Север',инн:"7707083893"});
  });
  it("does not accept invalid INN or javascript sources",()=>{
    const data=fromCsv("companies","Название;ИНН;Источник\nООО Тест;7707083892;javascript:alert(1)","bad.csv");
    expect(data.items).toHaveLength(0);expect(data.errors).toHaveLength(1);
  });
  it("separates participation from contracts in one procedure",()=>{
    const text="ИНН участника;Номер закупки;Тип события;Сумма\n7707083893;X;Участие;100\n7707083893;X;Договор;50";
    const data=fromCsv("tenders",text,"x.csv");
    expect(data.items.map(x=>x.event_type)).toEqual(["participation","contract"]);
    expect(data.items[1]?.amount).toBe(50);
  });
  it("maps court role without inventing a judgment",()=>{
    const data=fromCsv("cases","ИНН участника;Номер дела;Роль компании;Сумма требований\n7707083893;А40-123/26;Ответчик;120000","x.csv");
    expect(data.items[0]).toMatchObject({role:"defendant",claim_amount:120000,verification_status:"unverified"});
  });
  it("does not allow CSV formulas in template and never seeds sample records",()=>{
    expect(sampleCsv("products")).toContain("Артикул");
    expect(sampleCsv("companies").split("\r\n")).toHaveLength(2);
  });
});
