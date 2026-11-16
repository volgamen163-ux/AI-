import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { EntityKind, Workspace } from "../lib/types";
import { safeHttpUrl, validInn } from "../lib/validation";

const title:Record<EntityKind,string>={company:"Новая компания",product:"Новый товар",procurement:"Новая закупочная запись",court:"Новое судебное дело",offer:"Новое ценовое предложение"};
const req=(f:FormData,key:string)=>String(f.get(key)||"").trim();
export function EntityForm({kind,workspace,onSave,onClose}:{kind:EntityKind;workspace:Workspace;onSave:(kind:EntityKind,row:Record<string,unknown>)=>Promise<void>;onClose:()=>void}){
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");const f=new FormData(e.currentTarget);
  const source=req(f,"source_url");if(source&&!safeHttpUrl(source)){setError("Источник должен иметь адрес HTTPS или HTTP");return;}
  let row:Record<string,unknown>={};
  if(kind==="company"){
   const inn=req(f,"inn");if(!validInn(inn)){setError("Некорректная контрольная сумма ИНН");return;}
   row={inn,name:req(f,"name"),ogrn:req(f,"ogrn")||null,region:req(f,"region"),activity:req(f,"activity"),website:safeHttpUrl(req(f,"website")),director:req(f,"director"),legal_address:req(f,"legal_address"),email:req(f,"email"),phone:req(f,"phone"),source_url:source||null,source_provider:"manual",verification_status:"unverified"};
  }
  if(kind==="product")row={company_id:req(f,"company_id"),name:req(f,"name"),category:req(f,"category"),unit:req(f,"unit")||"шт.",availability:req(f,"availability")||"unknown",stock_qty:req(f,"stock_qty")?Number(req(f,"stock_qty")):null,source_url:source||null};
  if(kind==="procurement")row={company_id:req(f,"company_id"),procedure_number:req(f,"procedure_number"),customer:req(f,"customer"),event_type:req(f,"event_type"),law:req(f,"law"),amount:req(f,"amount")?Number(req(f,"amount")):null,occurred_at:req(f,"occurred_at")||null,source_url:source||null,source_provider:"manual",verification_status:"unverified",is_demo:false};
  if(kind==="court")row={company_id:req(f,"company_id"),case_number:req(f,"case_number"),court_name:req(f,"court_name"),role:req(f,"role"),stage:req(f,"stage")||"Не установлена",claim_amount:req(f,"claim_amount")?Number(req(f,"claim_amount")):null,filed_at:req(f,"filed_at")||null,source_url:source||null,source_provider:"manual",verification_status:"unverified",is_demo:false};
  if(kind==="offer")row={product_id:req(f,"product_id"),seller_name:req(f,"seller_name"),unit_price:Number(req(f,"unit_price")),currency:"RUB",stock_status:req(f,"stock_status"),observed_at:req(f,"observed_at")||new Date().toISOString().slice(0,10),source_url:source||null,verification_status:"unverified"};
  if(["offer","procurement","court"].includes(kind)){
   for(const key of ["unit_price","amount","claim_amount"]){if(row[key]!=null&&(!Number.isFinite(row[key])||Number(row[key])<0)){setError("Сумма или цена должна быть положительным числом");return;}}
  }
  if(kind==="product"&&row.stock_qty!=null&&(!Number.isFinite(row.stock_qty)||Number(row.stock_qty)<0)){setError("Количество должно быть неотрицательным");return;}
  setBusy(true);try{await onSave(kind,row);onClose();}catch(x){setError(x instanceof Error?x.message:String(x));}finally{setBusy(false);}
 }
 const field=(name:string,label:string,options?:{value:string;label:string}[],type="text",required=false)=><label className="field" key={name}><span>{label}</span>{options?<select name={name} required={required}>{options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select>:<input type={type} name={name} required={required} placeholder={label} min={type==="number"?"0":undefined} step={type==="number"?"any":undefined}/>}</label>;
 const companies=workspace.companies.map(c=>({value:c.id,label:c.name}));
 const products=workspace.products.map(p=>({value:p.id,label:p.name}));
 const source=field("source_url","Ссылка на первоисточник",undefined,"url");
 return <div className="modal-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
 <section className="dialog" role="dialog" aria-modal="true" aria-label={title[kind]}><div className="dialog-top"><div><span className="eyebrow">NEXUS / ДОБАВЛЕНИЕ</span><h2>{title[kind]}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X size={21}/></button></div><form onSubmit={e=>void submit(e)} className="form-grid">
 {kind==="company"&&<>{field("name","Название организации",undefined,"text",true)}{field("inn","ИНН (10/12 цифр)",undefined,"text",true)}{field("ogrn","ОГРН")}{field("region","Регион")}{field("activity","Отрасль / ОКВЭД")}{field("website","Сайт",undefined,"url")}{field("director","Руководитель")}{field("legal_address","Юридический адрес")}{field("email","Email",undefined,"email")}{field("phone","Телефон")}</>}
 {kind==="product"&&<>{field("company_id","Поставщик",companies,"text",true)}{field("name","Название товара",undefined,"text",true)}{field("category","Категория")}{field("unit","Единица измерения")}{field("availability","Наличие",[{value:"unknown",label:"Неизвестно"},{value:"in_stock",label:"Есть в наличии"},{value:"on_request",label:"Под заказ"},{value:"out_of_stock",label:"Нет в наличии"}])}{field("stock_qty","Остаток",undefined,"number")}</>}
 {kind==="procurement"&&<>{field("company_id","Участник / поставщик",companies,"text",true)}{field("procedure_number","Номер процедуры / договора",undefined,"text",true)}{field("customer","Заказчик",undefined,"text",true)}{field("event_type","Что произошло",[{value:"participation",label:"Участие"},{value:"win",label:"Заявленная победа"},{value:"contract",label:"Заключённый договор"},{value:"other",label:"Иное"}])}{field("law","Закон",[{value:"unknown",label:"Не указан"},{value:"44-FZ",label:"44-ФЗ"},{value:"223-FZ",label:"223-ФЗ"},{value:"other",label:"Другой"}])}{field("amount","Сумма, ₽",undefined,"number")}{field("occurred_at","Дата события",undefined,"date")}</>}
 {kind==="court"&&<>{field("company_id","Компания",companies,"text",true)}{field("case_number","Номер дела",undefined,"text",true)}{field("court_name","Суд",undefined,"text",true)}{field("role","Процессуальная роль",[{value:"unknown",label:"Не установлена"},{value:"plaintiff",label:"Истец"},{value:"defendant",label:"Ответчик"},{value:"third_party",label:"Третье лицо"},{value:"other",label:"Иная"}])}{field("stage","Стадия")}{field("claim_amount","Заявленные требования, ₽ (не долг)",undefined,"number")}{field("filed_at","Дата",undefined,"date")}</>}
 {kind==="offer"&&<>{field("product_id","Товар",products,"text",true)}{field("seller_name","Продавец",undefined,"text",true)}{field("unit_price","Цена за единицу, ₽",undefined,"number",true)}{field("stock_status","Наличие",[{value:"unknown",label:"Неизвестно"},{value:"in_stock",label:"Есть"},{value:"on_request",label:"Под заказ"},{value:"out_of_stock",label:"Нет"}])}{field("observed_at","Дата цены",undefined,"date")}</>}
 {source}<div className="form-bottom"><p>Новая запись получает статус «Не проверено». Ссылка сама по себе не подтверждает сведения.</p>{error&&<div className="inline-alert danger" role="alert">{error}</div>}<div className="row"><button type="button" className="btn line" onClick={onClose}>Отмена</button><button className="btn primary" disabled={busy}>{busy?"Сохраняем…":"Сохранить запись"}</button></div></div></form></section>
 </div>;
}
