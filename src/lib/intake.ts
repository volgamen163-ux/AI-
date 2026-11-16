import type { ImportPreview } from "../types";
import type { EntityKind, Workspace } from "./types";
import { safeHttpUrl, validInn } from "./validation";

export type ReadyRecord = { kind: EntityKind; row: Record<string,unknown> };
export type ReadyPreview = { valid:ReadyRecord[];errors:string[] };

function value(r:Record<string,unknown>,k:string):string{return String(r[k]??"").trim();}
function finiteOrNull(x:unknown):number|null{
 if(x==null||String(x).trim()==="")return null;
 const num=Number(x);if(!Number.isFinite(num)||num<0)throw Error("Сумма должна быть неотрицательным числом");return num;
}
function checkSource(r:Record<string,unknown>):string|null{
 const url=value(r,"source_url");
 if(url&&!safeHttpUrl(url))throw Error("Недопустимая ссылка на первоисточник");
 return url||null;
}
/** Converts legacy XML records into normalized, owner-scoped v2 rows. No source is verified implicitly. */
export function prepareXmlImport(preview:ImportPreview,workspace:Workspace):ReadyPreview {
 const valid:ReadyRecord[]=[],errors:string[]=[];
 const withinFile=new Set<string>();
 preview.items.forEach((entry,i)=>{
  try{
   const row:Record<string,unknown>={...entry};
   const source_url=checkSource(row);
   if(preview.type==="companies"){
    const inn=value(row,"inn"),name=value(row,"name");
    if(!validInn(inn))throw Error("Неверный ИНН");
    if(name.length<2)throw Error("Не указано название");
    if(workspace.companies.some(c=>c.inn===inn)||withinFile.has(inn))throw Error("Компания с этим ИНН уже есть");
    withinFile.add(inn);
    valid.push({kind:"company",row:{
     inn,name,ogrn:value(row,"ogrn")||null,region:value(row,"region"),
     activity:value(row,"activity"),website:safeHttpUrl(value(row,"website")),
     source_url,source_provider:"xml_upload",verification_status:"unverified"
    }});
    return;
   }
   const inn=value(row,"companyInn");
   if(!validInn(inn))throw Error("Неизвестный ИНН поставщика");
   const company=workspace.companies.find(c=>c.inn===inn);
   if(!company)throw Error("Сначала импортируйте компанию по ИНН "+inn);
   if(preview.type==="tenders"){
    const number=value(row,"procedure_number");
    if(!number)throw Error("Не указан номер контракта");
    const amount=finiteOrNull(row.amount);
    const type=value(row,"event_type");
    const event_type=type==="contract"?"contract":type==="participation"?"participation":type==="win"?"win":"other";
    const law=value(row,"law");
    valid.push({kind:"procurement",row:{company_id:company.id,procedure_number:number,
     customer:value(row,"customer"),event_type,law:law==="44-FZ"||law==="223-FZ"?law:"unknown",
     amount,occurred_at:value(row,"occurred_at")||null,source_url,
     source_provider:"xml_upload",verification_status:"unverified",is_demo:false}});
    return;
   }
   if(preview.type==="cases"){
    valid.push({kind:"court",row:{company_id:company.id,case_number:value(row,"case_number"),
     court_name:value(row,"court_name"),role:"unknown",stage:"Не проверено",
     claim_amount:finiteOrNull(row.claim_amount),source_url,source_provider:"xml_upload",
     verification_status:"unverified",is_demo:false}});return;
   }
   valid.push({kind:"product",row:{company_id:company.id,name:value(row,"name"),
    category:value(row,"category"),unit:value(row,"unit")||"шт.",
    availability:"unknown",stock_qty:finiteOrNull(row.stock_qty),source_url}});
  }catch(err){errors.push("Запись "+(i+1)+": "+(err instanceof Error?err.message:String(err)));}
 });
 return {valid,errors};
}
