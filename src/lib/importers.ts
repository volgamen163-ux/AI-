import type { ImportPreview } from "../types";
import { safeHttpUrl as safeUrl, validInn } from "./validation";

function canonical(k: string) { return k.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); }
function val(row:Record<string,string>,labels:string[]):string { for(const k of labels){const v=row[canonical(k)];if(v !== undefined)return v.trim();}return ""; }
function amount(s:string):number|null {
  if(!s.trim())return null;
  let a=s.replace(/[\s₽]/g,"");
  if(a.includes(",")&&a.includes("."))a=a.replace(/\./g,"").replace(",",".");
  else a=a.replace(",",".");
  if(!/^\d+(\.\d+)?$/.test(a))throw new Error("Некорректная сумма: "+s);
  return Number(a);
}
export function csvRows(csv:string):Record<string,string>[] {
  const src=csv.replace(/^\uFEFF/,"");
  const first=src.split(/\r?\n/,1)[0]||"";
  const separators=[";",",","\t"];
  const sep=separators.reduce((a,b)=>first.split(b).length>first.split(a).length?b:a);
  const matrix:string[][]=[];let quoted=false,field="",record:string[]=[];
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(ch==='"'){if(quoted&&src[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(ch===sep&&!quoted){record.push(field);field="";}
    else if((ch==="\r"||ch==="\n")&&!quoted){record.push(field);field="";if(ch==="\r"&&src[i+1]==="\n")i++;if(record.some(x=>x.trim()))matrix.push(record);record=[];}
    else field+=ch;
  }
  if(quoted)throw new Error("Незакрытые кавычки в CSV");
  record.push(field);if(record.some(x=>x.trim()))matrix.push(record);
  if(matrix.length<2)throw new Error("Нужны заголовки и минимум одна строка");
  const headings=matrix.shift()!.map(canonical);
  if(new Set(headings).size!==headings.length)throw new Error("Повторяющиеся колонки");
  if(matrix.length>500)throw new Error("Не более 500 записей за загрузку");
  return matrix.map(row=>Object.fromEntries(headings.map((h,i)=>[h,(row[i]||"").trim()])));
}
const innKeys=["инн","иннорганизации","иннучастника","иннпоставщика","inn","supplierinn","companyinn"];
const nameKeys=["название","наименование","компания","наименованиеорганизации","name","organizationname"];
const sourceKeys=["источник","ссылканаисточник","sourceurl","source","ссылка"];
export function mapImportRow(type:ImportPreview["type"],row:Record<string,string>):Record<string,unknown> {
  const inn=val(row,innKeys);
  if(!validInn(inn))throw new Error("ИНН отсутствует или неверная контрольная сумма");
  const source=val(row,sourceKeys);
  if(source&&!safeUrl(source))throw new Error("Недопустимый URL источника");
  if(type==="companies"){
    const name=val(row,nameKeys);
    if(name.length<2)throw new Error("Название компании отсутствует");
    const website=val(row,["website","сайт","site"]);
    if(website&&!safeUrl(website))throw new Error("Некорректный сайт");
    const ogrn=val(row,["огрн","огрнип","ogrn"]);
    if(ogrn&&!/^\d{13}(\d{2})?$/.test(ogrn))throw new Error("ОГРН / ОГРНИП должен содержать 13 / 15 цифр");
    return {inn,ogrn:ogrn||null,name,region:val(row,["регион","город","region"]),activity:val(row,["оквэд","деятельность","отрасль","activity"]),website:website||null,source_url:source||null,source_provider:"csv",verification_status:"unverified"};
  }
  if(type==="tenders"){
    const procedure_number=val(row,["номер","номерзакупки","номердоговора","номеризвещения","реестровыйномер","procedurenumber","number"]);
    if(!procedure_number)throw new Error("Нет номера процедуры / договора");
    const event=canonical(val(row,["типсобытия","видсобытия","eventtype","статус"]));
    const event_type=({участие:"participation",участник:"participation",победа:"win",победил:"win",договор:"contract",контракт:"contract",other:"other",participation:"participation",win:"win",contract:"contract"} as Record<string,string>)[event]||"other";
    const lawRaw=canonical(val(row,["закон","law"]));
    const law=lawRaw.includes("223")?"223-FZ":lawRaw.includes("44")?"44-FZ":"unknown";
    return {companyInn:inn,procedure_number,customer:val(row,["заказчик","customer"]),event_type,law,amount:amount(val(row,["сумма","amount","цена"])),occurred_at:val(row,["дата","date"])||null,source_url:source||null,source_provider:"csv",verification_status:"unverified",is_demo:false};
  }
  if(type==="cases"){
    const case_number=val(row,["номердела","case","casenumber","номер"]);
    if(!case_number)throw new Error("Нет номера дела");
    const role=canonical(val(row,["роль","ролькомпании","рольвделе","role"]));
    const role_code=({истец:"plaintiff",plaintiff:"plaintiff",ответчик:"defendant",defendant:"defendant",третьелицо:"third_party",thirdparty:"third_party"} as Record<string,string>)[role]||"unknown";
    return {companyInn:inn,case_number,court_name:val(row,["суд","court"]),role:role_code,stage:val(row,["статус","стадия","stage"])||"unknown",claim_amount:amount(val(row,["сумматребований","суммаиска","claimamount"])),filed_at:val(row,["дата","date"])||null,source_url:source||null,source_provider:"csv",verification_status:"unverified",is_demo:false};
  }
  const name=val(row,["товар","наименованиетовара","названиетовара","наименованиепродукции","product","name"]);
  if(!name)throw new Error("Нет названия товара");
  const availability=canonical(val(row,["наличие","availability"]));
  const status=availability.includes("склад")||availability==="instock"?"in_stock":availability.includes("заказ")?"on_request":availability.includes("нет")?"out_of_stock":"unknown";
  return {companyInn:inn,name,category:val(row,["категория","category"]),unit:val(row,["единица","едизм","unit"])||"шт",sku:val(row,["артикул","sku"])||null,availability:status,stock_qty:amount(val(row,["остаток","количество","quantity"])),source_url:source||null,source_date:null};
}
export function fromCsv(type:ImportPreview["type"],text:string,filename:string):ImportPreview {
  const lines=csvRows(text);const items:Record<string,unknown>[]=[],errors:string[]=[];
  lines.forEach((line,i)=>{try{items.push(mapImportRow(type,line));}catch(e){errors.push("Строка "+(i+2)+": "+(e instanceof Error?e.message:String(e)));}});
  return {type,filename,items,errors,total:lines.length,info:"CSV прочитан локально. Сведения и источники не проверены."};
}
function attr(e:Element|null,k:string[]):string {
  if(!e)return "";
  for(const key of k){const value=e.getAttribute(key);if(value)return value.trim();}
  return "";
}
function find(el:Element, names:string[]):Element|null {
  return Array.from(el.getElementsByTagName("*")).find(x=>names.includes(x.localName))||null;
}
export function fromXml(xml:string,filename:string):ImportPreview {
  if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))throw new Error("DTD / внешние сущности запрещены");
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror")||!doc.documentElement)throw new Error("Некорректный XML");
  const nodes=Array.from(doc.getElementsByTagName("*"));
  const entities=nodes.filter(x=>["СвЮЛ","СвИП"].includes(x.localName));
  if(entities.length){
    if(entities.length>500)throw new Error("Слишком большой XML");
    const items:Record<string,unknown>[]=[],errors:string[]=[];
    entities.forEach((el,i)=>{
      try{
        const isIp=el.localName==="СвИП",label=find(el,["СвНаимЮЛ","НаимЮЛ"]),fio=find(el,["СвФЛ","ФИО"]);
        const inn=attr(el,isIp?["ИННФЛ","ИНН"]:["ИНН"]);
        const name=isIp?"ИП "+[attr(fio,["Фамилия"]),attr(fio,["Имя"]),attr(fio,["Отчество"])].filter(Boolean).join(" "):attr(label,["НаимЮЛПолн","НаимЮЛСокр"])||attr(el,["ПолнНаимОПФ","НаимЮЛПолн"]);
        const normalized:Record<string,string>={инн:inn,название:name,огрн:attr(el,isIp?["ОГРНИП","ОГРН"]:["ОГРН"])};
        const row=mapImportRow("companies",normalized);
        row.source_provider="xml_upload";items.push(row);
      }catch(e){errors.push("Запись "+(i+1)+": "+(e instanceof Error?e.message:String(e)));}
    });
    return {type:"companies",filename,items,errors,total:entities.length,info:"XML ЕГРЮЛ/ЕГРИП. Электронная подпись, полнота и происхождение НЕ проверены."};
  }
  const contracts=nodes.filter(x=>["contract44","contract223","contractInfo"].includes(x.localName));
  if(!contracts.length)throw new Error("Формат XML не распознан; поддерживаются ЕГРЮЛ/ЕГРИП и ограниченные XML-контракты");
  if(contracts.length>500)throw new Error("Больше 500 контрактов");
  const items:Record<string,unknown>[]=[],errors:string[]=[];
  contracts.forEach((x,i)=>{
    try {
      const customer=find(x,["customer","customerInfo"]);
      const supplier=find(x,["supplier","supplierInfo"]);
      const inn=supplier?find(supplier,["INN","inn"])?.textContent?.trim()||attr(supplier,["INN","inn"]):"";
      if(!validInn(inn))throw new Error("Не найден корректный ИНН поставщика");
      const number=find(x,["regNum","contractNumber","contractNum"])?.textContent?.trim()||"";
      if(!number)throw new Error("Не указан номер договора");
      const customerName=customer?find(customer,["fullName","name"])?.textContent?.trim()||"":"";
      const price=find(x,["contractPrice","price"])?.textContent?.trim()||"";
      const row=mapImportRow("tenders",{инн:inn,номерзакупки:number,заказчик:customerName,типсобытия:"договор",закон:x.localName==="contract223"?"223-ФЗ":"44-ФЗ",сумма:price});
      row.source_provider="xml_upload";items.push(row);
    }catch(e){errors.push("Контракт "+(i+1)+": "+(e instanceof Error?e.message:String(e)));}
  });
  return {type:"tenders",filename,items,errors,total:contracts.length,info:"Ограниченная структура XML контрактов. Договор НЕ доказывает победу; подпись и реестр не проверены."};
}
export function sampleCsv(type:ImportPreview["type"]):string {
  const headers={
    companies:"Название;ИНН;ОГРН;Регион;Отрасль;Сайт;Источник",
    tenders:"ИНН участника;Номер закупки;Заказчик;Тип события;Закон;Статус;Сумма;Дата;Источник",
    cases:"ИНН участника;Номер дела;Суд;Роль компании;Статус;Сумма требований;Дата;Источник",
    products:"ИНН поставщика;Название товара;Категория;Единица;Артикул;Наличие;Количество;Источник",
  };
  return "\uFEFF"+headers[type]+"\r\n";
}
