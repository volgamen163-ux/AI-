import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Building2, CheckCircle2,
  ChevronRight, CircleAlert, Clock3, Cloud, Database, ExternalLink, FileText, FileUp, Filter,
  Globe2, Layers3, Link2, LockKeyhole, LogIn, LogOut, Menu, Network, Package, Plus,
  RefreshCw, Scale, Search, Settings2, ShieldCheck, Sparkles, TrendingUp, X
} from "lucide-react";
import type { BankCard, Company, CourtCase, EntityTable, ImportPreview, MarketOffer, Page, Product, Procurement, Provider, Relation, SearchResponse, Workspace } from "./types";
import { EMPTY_WORKSPACE } from "./types";
import { companyScope, courtSummary, median, money, procurementSummary, productInsight, relationSignals, safeUrl, sourceLabel, statistics, validInn } from "./lib/analytics";
import { csvRows, fromCsv, fromXml, sampleCsv } from "./lib/importers";
import { cloud, connectionChecks, deleteRecord, fetchWorkspace, getProviders, lookupCompany, saveRecord } from "./lib/supabase";
import "./styles.css";

const NAV: {id:Page;label:string;short:string;icon:typeof Building2}[]=[
  {id:"overview",label:"Обзор платформы",short:"Обзор",icon:Layers3},
  {id:"companies",label:"Компании",short:"Компании",icon:Building2},
  {id:"products",label:"Продукция и остатки",short:"Товары",icon:Package},
  {id:"tenders",label:"Закупки и договоры",short:"Закупки",icon:FileText},
  {id:"courts",label:"Судебные дела",short:"Суды",icon:Scale},
  {id:"market",label:"Анализ рынка",short:"Рынок",icon:BarChart3},
  {id:"relations",label:"Аффилированность",short:"Связи",icon:Network},
  {id:"sources",label:"Реестры и источники",short:"Источники",icon:Globe2},
  {id:"import",label:"Импорт реестров",short:"Импорт",icon:FileUp},
  {id:"settings",label:"Настройки системы",short:"Система",icon:Settings2},
];
type FormKind="company"|"product"|"tender"|"case"|"offer"|"relation";
type FormField={key:string;label:string;type?:"text"|"url"|"date"|"number"|"select";required?:boolean;options?:{value:string;label:string}[];placeholder?:string};
type ModalForm={kind:FormKind;id?:string};
type Notice={message:string;error?:boolean}|null;
const KIND_TABLE:Record<FormKind,EntityTable>={company:"na2_companies",product:"na2_products",tender:"na2_procurements",case:"na2_court_cases",offer:"na2_market_offers",relation:"na2_company_relations"};
const KIND_TITLE:Record<FormKind,string>={company:"Компания",product:"Товар",tender:"Закупочное событие",case:"Судебная запись",offer:"Рыночное предложение",relation:"Сигнал связи"};
const DEMO={
 companies:[
  {id:"dc1",user_id:"DEMO",name:"ООО «Северный образец»",inn:"ДЕМО-001",ogrn:null,region:"Самарская область",activity:"Полиграфия",website:null,source_url:null,source_provider:"demo",verification_status:"unverified",checked_at:null},
  {id:"dc2",user_id:"DEMO",name:"ООО «Волжский пример»",inn:"ДЕМО-002",ogrn:null,region:"Нижегородская область",activity:"Канцтовары",website:null,source_url:null,source_provider:"demo",verification_status:"unverified",checked_at:null},
  {id:"dc3",user_id:"DEMO",name:"ООО «Модуль-тест»",inn:"ДЕМО-003",ogrn:null,region:"Самарская область",activity:"Электрооборудование",website:null,source_url:null,source_provider:"demo",verification_status:"unverified",checked_at:null},
 ] as Company[],
 products:[
  {id:"dp1",user_id:"DEMO",company_id:"dc1",name:"Бланк А4, бумага 120 г/м²",category:"Полиграфия",unit:"шт",sku:"DEMO-BL-A4",availability:"in_stock",stock_qty:4000,source_url:null,source_date:null},
  {id:"dp2",user_id:"DEMO",company_id:"dc2",name:"Ежедневник А5, синий",category:"Канцтовары",unit:"шт",sku:"DEMO-DI-5",availability:"on_request",stock_qty:null,source_url:null,source_date:null},
  {id:"dp3",user_id:"DEMO",company_id:"dc3",name:"Кабель силовой",category:"Электрика",unit:"м",sku:"DEMO-CAB",availability:"unknown",stock_qty:null,source_url:null,source_date:null},
 ] as Product[],
 tenders:[
  {id:"dt1",user_id:"DEMO",company_id:"dc1",procedure_number:"DEMO-223-001",customer:"Учебный заказчик",event_type:"participation",law:"223-FZ",amount:75000,occurred_at:"2026-09-12",source_url:null,source_provider:"demo",verification_status:"unverified",is_demo:false},
  {id:"dt2",user_id:"DEMO",company_id:"dc1",procedure_number:"DEMO-223-001",customer:"Учебный заказчик",event_type:"contract",law:"223-FZ",amount:64000,occurred_at:"2026-10-02",source_url:null,source_provider:"demo",verification_status:"unverified",is_demo:false},
  {id:"dt3",user_id:"DEMO",company_id:"dc2",procedure_number:"DEMO-44-002",customer:"Учебный муниципальный заказчик",event_type:"win",law:"44-FZ",amount:139000,occurred_at:"2026-10-14",source_url:null,source_provider:"demo",verification_status:"unverified",is_demo:false},
 ] as Procurement[],
 cases:[
  {id:"dcase1",user_id:"DEMO",company_id:"dc2",case_number:"ДЕМО-А40/2026",court_name:"Учебный арбитражный суд",role:"plaintiff",stage:"Рассматривается",claim_amount:120000,filed_at:"2026-09-08",source_url:null,source_provider:"demo",verification_status:"unverified",is_demo:false},
 ] as CourtCase[],
 offers:[
  {id:"do1",user_id:"DEMO",product_id:"dp1",seller_name:"Поставщик А (ДЕМО)",unit_price:16.4,currency:"RUB",stock_status:"in_stock",observed_at:"2026-11-10",source_url:null,verification_status:"unverified"},
  {id:"do2",user_id:"DEMO",product_id:"dp1",seller_name:"Поставщик Б (ДЕМО)",unit_price:18.8,currency:"RUB",stock_status:"on_request",observed_at:"2026-11-11",source_url:null,verification_status:"unverified"},
  {id:"do3",user_id:"DEMO",product_id:"dp1",seller_name:"Поставщик В (ДЕМО)",unit_price:21.2,currency:"RUB",stock_status:"unknown",observed_at:"2026-11-12",source_url:null,verification_status:"unverified"},
  {id:"do4",user_id:"DEMO",product_id:"dp2",seller_name:"Поставщик Г (ДЕМО)",unit_price:540,currency:"RUB",stock_status:"in_stock",observed_at:"2026-11-10",source_url:null,verification_status:"unverified"},
 ] as MarketOffer[],
 relations:[
  {id:"dr1",user_id:"DEMO",company_a:"dc1",company_b:"dc2",signal_type:"address",signal_value:"Учебное совпадение адреса",source_url:null,verification_status:"unverified"},
 ] as Relation[],
} satisfies Workspace;
const SOURCE_LINKS=[
 {id:"fns",name:"ФНС · Прозрачный бизнес",url:"https://pb.nalog.ru/",summary:"Юридические лица, ЕГРЮЛ"},
 {id:"eis",name:"ЕИС · Закупки",url:"https://zakupki.gov.ru/",summary:"44-ФЗ, 223-ФЗ, контракты"},
 {id:"kad",name:"КАД Арбитр",url:"https://kad.arbitr.ru/",summary:"Арбитражные дела"},
 {id:"fedresurs",name:"Федресурс",url:"https://fedresurs.ru/",summary:"Юридически значимые сведения"},
 {id:"fssp",name:"ФССП",url:"https://fssp.gov.ru/iss/ip/",summary:"Исполнительные производства"},
 {id:"gisp",name:"ГИСП",url:"https://gisp.gov.ru/",summary:"Российские производители и продукция"},
];
function localDate(){return new Date().toISOString().slice(0,10);}
function prettyDay(x:string|null|undefined){return x?new Date(x+"T12:00:00").toLocaleDateString("ru-RU"):"—";}
function emptyText(v:string|null|undefined){return v?.trim()||"Не указано";}
function statusName(x:string){return ({in_stock:"В наличии",on_request:"Под заказ",out_of_stock:"Нет в наличии",unknown:"Не подтверждено"} as Record<string,string>)[x]||"Не подтверждено";}
function eventName(e:string){return ({participation:"Участие",win:"Заявлена победа",contract:"Договор",other:"Не определено"} as Record<string,string>)[e]||"Не определено";}
function roleName(x:string){return ({plaintiff:"Истец",defendant:"Ответчик",third_party:"Третье лицо",other:"Иная роль",unknown:"Не определена"} as Record<string,string>)[x]||"Не определена";}
function fileSave(content:string,filename:string){const blob=new Blob([content],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200);}
function csvCell(v:unknown){let a=String(v??"");if(/^[\s\0-\x1f]*[=+@-]/.test(a))a="'"+a;return '"'+a.replace(/"/g,'""')+'"';}
function csvExport(columns:string[],rows:unknown[][],filename:string){fileSave("\uFEFF"+[columns,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n"),filename);}
const providerStatus=(code:string)=>code==="live_partial"?"Частичный API":code==="manual"?"Сайт / ручная проверка":code==="credentials_required"?"Требуется доступ":code==="licensed_or_manual"?"API по договору":"Не подключено";

function Badge({children,tone="muted"}:{children:ReactNode;tone?:"muted"|"positive"|"warning"|"blue"|"gold"}){
 return <span className={"badge badge-"+tone}>{children}</span>;
}
function SourceBadge({status}:{status:string}) {
 return <Badge tone={status==="official_verified"?"positive":status==="user_verified"?"blue":"warning"}>{sourceLabel(status)}</Badge>;
}
function Empty({icon:Icon=Layers3,title,detail,action}:{icon?:typeof Building2;title:string;detail:string;action?:ReactNode}){
 return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><h3>{title}</h3><p>{detail}</p>{action&&<div className="empty-action">{action}</div>}</div>;
}
function Stat({title,value,note,icon:Icon}:{title:string;value:string|number;note:string;icon:typeof Building2}){
 return <div className="stat-card"><span className="stat-icon"><Icon size={19}/></span><span className="stat-value">{value}</span><strong>{title}</strong><small>{note}</small></div>;
}
function PageHead({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode}){
 return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action&&<div className="page-action">{action}</div>}</div>;
}
function Section({title,info,action,children,className=""}:{title:string;info?:string;action?:ReactNode;children:ReactNode;className?:string}){
 return <section className={"panel "+className}><div className="section-head"><div><h2>{title}</h2>{info&&<p>{info}</p>}</div>{action}</div>{children}</section>;
}
function InlineLink({url,children}:{url?:string|null;children:ReactNode}){
 const to=safeUrl(url);return to?<a className="inline-link" href={to} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={13}/></a>:<span className="text-dim">Источник не указан</span>;
}
function Action({children,onClick,variant="secondary",disabled=false,icon:Icon}:{children:ReactNode;onClick?:()=>void;variant?:"primary"|"secondary"|"ghost"|"gold";disabled?:boolean;icon?:typeof Building2}){
 return <button type="button" className={"action action-"+variant} onClick={onClick} disabled={disabled}>{Icon&&<Icon size={16}/>}<span>{children}</span></button>;
}
function Field({field,value,onChange}:{field:FormField;value:string;onChange:(value:string)=>void}){
 return <label className="form-field"><span>{field.label}{field.required&&<i>*</i>}</span>{field.type==="select"?<select value={value} onChange={e=>onChange(e.target.value)} required={field.required}><option value="">Выберите</option>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input type={field.type||"text"} value={value} onChange={e=>onChange(e.target.value)} required={field.required} step={field.type==="number"?"any":undefined} min={field.type==="number"?"0":undefined} placeholder={field.placeholder||field.label}/>}</label>;
}
function FormFields(kind:FormKind,data:Workspace):FormField[]{
 const companies=data.companies.map(x=>({value:x.id,label:x.name}));
 const products=data.products.map(x=>({value:x.id,label:x.name}));
 if(kind==="company")return [
  {key:"inn",label:"ИНН",required:true,placeholder:"10 или 12 цифр"},
  {key:"name",label:"Название организации",required:true},
  {key:"ogrn",label:"ОГРН / ОГРНИП"},
  {key:"region",label:"Регион"},
  {key:"activity",label:"Основной вид деятельности"},
  {key:"website",label:"Сайт компании",type:"url"},
  {key:"source_url",label:"Ссылка на источник",type:"url"},
 ];
 if(kind==="product")return [
  {key:"company_id",label:"Компания",type:"select",options:companies,required:true},
  {key:"name",label:"Наименование товара",required:true},
  {key:"category",label:"Категория"},
  {key:"unit",label:"Единица измерения",placeholder:"шт"},
  {key:"sku",label:"Артикул"},
  {key:"availability",label:"Наличие",type:"select",required:true,options:[{value:"unknown",label:"Неизвестно"},{value:"in_stock",label:"В наличии"},{value:"on_request",label:"Под заказ"},{value:"out_of_stock",label:"Нет в наличии"}]},
  {key:"stock_qty",label:"Остаток",type:"number"},
  {key:"source_url",label:"Ссылка на карточку товара",type:"url"},
 ];
 if(kind==="tender")return [
  {key:"company_id",label:"Поставщик",type:"select",required:true,options:companies},
  {key:"procedure_number",label:"Номер процедуры / договора",required:true},
  {key:"customer",label:"Заказчик"},
  {key:"event_type",label:"Тип события",type:"select",required:true,options:[{value:"participation",label:"Участие"},{value:"win",label:"Заявлена победа"},{value:"contract",label:"Договор"},{value:"other",label:"Не определено"}]},
  {key:"law",label:"Закон",type:"select",options:[{value:"unknown",label:"Не определён"},{value:"44-FZ",label:"44-ФЗ"},{value:"223-FZ",label:"223-ФЗ"},{value:"other",label:"Другое"}]},
  {key:"amount",label:"Сумма, ₽",type:"number"},
  {key:"occurred_at",label:"Дата",type:"date"},
  {key:"source_url",label:"URL документа",type:"url"},
 ];
 if(kind==="case")return [
  {key:"company_id",label:"Компания",type:"select",required:true,options:companies},
  {key:"case_number",label:"Номер дела",required:true},
  {key:"court_name",label:"Суд"},
  {key:"role",label:"Роль компании",type:"select",required:true,options:[{value:"unknown",label:"Не определена"},{value:"plaintiff",label:"Истец"},{value:"defendant",label:"Ответчик"},{value:"third_party",label:"Третье лицо"},{value:"other",label:"Другая"}]},
  {key:"stage",label:"Стадия"},
  {key:"claim_amount",label:"Сумма требований, ₽",type:"number"},
  {key:"filed_at",label:"Дата",type:"date"},
  {key:"source_url",label:"Ссылка на карточку дела",type:"url"},
 ];
 if(kind==="offer")return [
  {key:"product_id",label:"Товар",type:"select",required:true,options:products},
  {key:"seller_name",label:"Продавец",required:true},
  {key:"unit_price",label:"Цена за единицу, ₽",type:"number",required:true},
  {key:"stock_status",label:"Наличие",type:"select",options:[{value:"unknown",label:"Неизвестно"},{value:"in_stock",label:"В наличии"},{value:"on_request",label:"Под заказ"},{value:"out_of_stock",label:"Нет"}]},
  {key:"observed_at",label:"Дата проверки",type:"date"},
  {key:"source_url",label:"Ссылка на предложение",type:"url"},
 ];
 return [
  {key:"company_a",label:"Компания А",type:"select",required:true,options:companies},
  {key:"company_b",label:"Компания Б",type:"select",required:true,options:companies},
  {key:"signal_type",label:"Признак",type:"select",required:true,options:[{value:"director",label:"Общий руководитель"},{value:"address",label:"Совпадение адреса"},{value:"phone",label:"Телефон"},{value:"email",label:"Email"},{value:"founder",label:"Учредитель"},{value:"other",label:"Другое"}]},
  {key:"signal_value",label:"Значение признака"},
  {key:"source_url",label:"Документ / источник",type:"url"},
 ];
}
function decodeDataFile(file:File):Promise<string>{
 return file.arrayBuffer().then(buffer=>{
  const bytes=new Uint8Array(buffer);
  const prefix=new TextDecoder("iso-8859-1").decode(bytes.slice(0,200));
  const declared=prefix.match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1]||"";
  let charset=file.name.toLowerCase().endsWith(".xml")?declared.toLowerCase()||"utf-8":"utf-8";
  if(charset==="cp1251")charset="windows-1251";
  if(!["utf-8","utf8","windows-1251","utf-16","utf-16le","utf-16be"].includes(charset))throw new Error("Неподдерживаемая кодировка XML");
  return new TextDecoder(charset,{fatal:true}).decode(bytes);
 });
}
function makeError(e:unknown){return e instanceof Error?e.message:String(e);}

export default function App(){
 const [page,setPage]=useState<Page>("overview");
 const [mobileNav,setMobileNav]=useState(false);
 const [session,setSession]=useState<Session|null>(null);
 const [authOpen,setAuthOpen]=useState(false);
 const [authSignup,setAuthSignup]=useState(false);
 const [authEmail,setAuthEmail]=useState("");
 const [authPassword,setAuthPassword]=useState("");
 const [authBusy,setAuthBusy]=useState(false);
 const [data,setData]=useState<Workspace>(EMPTY_WORKSPACE);
 const [demo,setDemo]=useState(true);
 const [loading,setLoading]=useState(false);
 const [notice,setNotice]=useState<Notice>(null);
 const [providers,setProviders]=useState<Provider[]>([]);
 const [providersError,setProvidersError]=useState("");
 const [query,setQuery]=useState("");
 const [companyId,setCompanyId]=useState("");
 const [productId,setProductId]=useState("");
 const [searchInn,setSearchInn]=useState("7707083893");
 const [searchOgrn,setSearchOgrn]=useState("");
 const [searchResult,setSearchResult]=useState<SearchResponse|null>(null);
 const [researchBusy,setResearchBusy]=useState(false);
 const [form,setForm]=useState<ModalForm|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [saving,setSaving]=useState(false);
 const [importType,setImportType]=useState<ImportPreview["type"]>("companies");
 const [preview,setPreview]=useState<ImportPreview|null>(null);
 const [importBusy,setImportBusy]=useState(false);
 const [diagnostics,setDiagnostics]=useState<{name:string,ok:boolean,message:string}[]|null>(null);
 const [diagnosticsBusy,setDiagnosticsBusy]=useState(false);
 const [tenderKind,setTenderKind]=useState("all");
 const [courtRole,setCourtRole]=useState("all");
 const [sourceFilter,setSourceFilter]=useState("all");
 const [selectedProduct,setSelectedProduct]=useState("");
 const current=demo?DEMO:data;
 const stats=useMemo(()=>statistics(current),[current]);
 const lookup=useCallback((id:string)=>current.companies.find(x=>x.id===id)?.name||"Неизвестная компания",[current.companies]);
 const notify=(message:string,error=false)=>{setNotice({message,error});};
 const navigate=(id:Page)=>{setPage(id);setMobileNav(false);window.scrollTo({top:0,behavior:"smooth"});};
 const load=useCallback(async()=>{
  if(!cloud)return;
  setLoading(true);
  try{setData(await fetchWorkspace());}
  catch(e){setNotice({message:"Ошибка синхронизации: "+makeError(e),error:true});}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  if(!cloud)return;
  void cloud.auth.getSession().then(r=>setSession(r.data.session));
  const {data:sub}=cloud.auth.onAuthStateChange((_event,s)=>setSession(s));
  return ()=>sub.subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(session){setDemo(false);void load();}else{setData(EMPTY_WORKSPACE);setDemo(true);}},[session?.user.id,load]);
 useEffect(()=>{void getProviders().then(setProviders).catch(e=>setProvidersError(makeError(e)));},[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(null),5500);return()=>clearTimeout(t);},[notice]);
 const selectedCompany=current.companies.find(x=>x.id===companyId);
 const chosenProduct=current.products.find(x=>x.id===(selectedProduct||productId));
 function startForm(kind:FormKind,item?:Record<string,unknown>){
  if(!session){setAuthOpen(true);notify("Для сохранения войди в тестовый аккаунт");return;}
  if(demo){notify("Выйди из деморежима для записи в облако");return;}
  const now:Record<string,string>={};
  for(const [key,value] of Object.entries(item||{}))now[key]=value==null?"":String(value);
  if(kind==="product"&&!now.company_id)now.company_id=companyId;
  if(kind==="tender"&&!now.company_id)now.company_id=companyId;
  if(kind==="case"&&!now.company_id)now.company_id=companyId;
  if(kind==="offer"&&!now.product_id)now.product_id=selectedProduct||productId;
  if(kind==="offer"&&!now.observed_at)now.observed_at=localDate();
  if(kind==="offer"&&!now.stock_status)now.stock_status="unknown";
  if(kind==="tender"&&!now.event_type)now.event_type="other";
  if(kind==="tender"&&!now.law)now.law="unknown";
  if(kind==="case"&&!now.role)now.role="unknown";
  if(kind==="product"&&!now.availability)now.availability="unknown";
  setDraft(now);setForm({kind,id:typeof item?.id==="string"?item.id:undefined});
 }
 async function submitForm(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!form||!session)return;
  const kind=form.kind,fields=FormFields(kind,data),row:Record<string,unknown>={};
  for(const field of fields){
   const value=(draft[field.key]||"").trim();
   row[field.key]=field.type==="number"?(value?Number(value):null):value||null;
  }
  if(form.id)row.id=form.id;
  if(kind==="company"){
   if(!validInn(String(row.inn||""))){notify("ИНН не прошёл контрольную сумму",true);return;}
   row.source_provider="manual";row.verification_status=row.source_url?"source_linked":"unverified";
   row.region=row.region||"";row.activity=row.activity||"";
  }
  if(kind==="product"){row.unit=row.unit||"шт";row.availability=row.availability||"unknown";}
  if(kind==="tender"){row.event_type=row.event_type||"other";row.law=row.law||"unknown";row.customer=row.customer||"";row.source_provider="manual";row.verification_status=row.source_url?"source_linked":"unverified";row.is_demo=false;}
  if(kind==="case"){row.role=row.role||"unknown";row.stage=row.stage||"unknown";row.court_name=row.court_name||"";row.source_provider="manual";row.verification_status=row.source_url?"source_linked":"unverified";row.is_demo=false;}
  if(kind==="offer"){row.currency="RUB";row.stock_status=row.stock_status||"unknown";row.observed_at=row.observed_at||localDate();row.verification_status=row.source_url?"source_linked":"unverified";}
  if(kind==="relation"){if(row.company_a===row.company_b){notify("Нужны две разные компании",true);return;}row.signal_value=row.signal_value||"";row.verification_status=row.source_url?"source_linked":"unverified";}
  const link=row.source_url??row.website;
  if(link&&!safeUrl(String(link))){notify("Используй ссылку http:// или https://",true);return;}
  setSaving(true);
  try{
   await saveRecord(KIND_TABLE[kind],row,session.user.id);
   await load();setForm(null);notify("Сохранено в Supabase STAGING");
  }catch(e){notify("Не удалось сохранить: "+makeError(e),true);}
  finally{setSaving(false);}
 }
 async function removeRow(kind:FormKind,id:string){
  if(!session||demo)return;
  if(!window.confirm("Удалить запись? Это действие нельзя отменить."))return;
  try{await deleteRecord(KIND_TABLE[kind],id,session.user.id);await load();notify("Запись удалена");}
  catch(e){notify("Ошибка удаления: "+makeError(e),true);}
 }
 async function authSubmit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!cloud){notify("Облачная конфигурация ещё не настроена",true);return;}
  setAuthBusy(true);
  try{
   const result=authSignup?await cloud.auth.signUp({email:authEmail,password:authPassword}):await cloud.auth.signInWithPassword({email:authEmail,password:authPassword});
   if(result.error)throw result.error;
   setAuthOpen(false);setAuthPassword("");notify(authSignup?"Аккаунт создан. Если требуется, подтверди email.":"Вход выполнен");
  }catch(e){notify(makeError(e),true);}finally{setAuthBusy(false);}
 }
 async function runResearch(inn=searchInn,ogrn=searchOgrn){
  if(!validInn(inn)){notify("Неверный ИНН",true);return;}
  if(ogrn&&!/^\d{13}$/.test(ogrn)){notify("Для поиска по Банку России укажи ОГРН из 13 цифр",true);return;}
  setResearchBusy(true);setSearchResult(null);setSearchInn(inn);setSearchOgrn(ogrn);
  try{const found=await lookupCompany(inn,ogrn);setSearchResult(found.source);}
  catch(e){notify("Поиск: "+makeError(e),true);}
  finally{setResearchBusy(false);}
 }
 async function saveOfficial(card:BankCard){
  if(!session){setAuthOpen(true);return;}
  if(!card.verified||!validInn(card.inn)||!safeUrl(card.sourceUrl)){notify("Источник не прошёл проверку",true);return;}
  setSaving(true);
  try{
   const row={inn:card.inn,ogrn:card.ogrn,name:card.name,region:card.region||"",activity:"Финансовые услуги",website:safeUrl(card.site),source_url:card.sourceUrl,source_provider:"cbr",verification_status:"official_verified",checked_at:card.retrievedAt||new Date().toISOString()};
   const {error}=await cloud!.from("na2_companies").upsert({...row,user_id:session.user.id},{onConflict:"user_id,inn"});
   if(error)throw error;
   await load();setDemo(false);navigate("companies");notify("Карточка подтверждённой организации сохранена");
  }catch(e){notify("Ошибка сохранения: "+makeError(e),true);}
  finally{setSaving(false);}
 }
 async function importFile(file:File){
  if(file.size>2_000_000){notify("Максимум 2 МБ на файл",true);return;}
  try{const text=await decodeDataFile(file);const result=file.name.toLowerCase().endsWith(".xml")?fromXml(text,file.name):fromCsv(importType,text,file.name);
   setPreview(result);if(result.errors.length)notify("Обнаружены ошибки в "+result.errors.length+" строках",true);
  }catch(e){notify("Импорт: "+makeError(e),true);}
 }
 async function commitImport(){
  if(!session||demo){setAuthOpen(true);return;}if(!preview)return;
  if(!window.confirm("Добавить "+preview.items.length+" непроверенных записей в тестовую базу?"))return;
  setImportBusy(true);
  let added=0,duplicates=0,rejected=0;const companiesByInn=new Map(data.companies.map(x=>[x.inn,x.id]));
  try{
   for(const item of preview.items){
    try{
     const row={...item};delete row.companyInn;
     if(preview.type==="companies"){
      const inn=String(row.inn||"");if(companiesByInn.has(inn)){duplicates++;continue;}
      await saveRecord("na2_companies",row,session.user.id);
      const fresh=await cloud!.from("na2_companies").select("id").eq("inn",inn).single();
      if(fresh.error)throw fresh.error;companiesByInn.set(inn,String(fresh.data.id));
     }else{
      const company_id=companiesByInn.get(String(item.companyInn||""));
      if(!company_id){rejected++;continue;}
      row.company_id=company_id;
      const table=KIND_TABLE[preview.type==="tenders"?"tender":preview.type==="cases"?"case":"product"];
      await saveRecord(table,row,session.user.id);
     }
     added++;
    }catch{rejected++;}
   }
   setPreview(null);await load();notify("Добавлено: "+added+" · пропущено: "+rejected+" · совпадений: "+duplicates);
  }catch(e){notify(makeError(e),true);}finally{setImportBusy(false);}
 }
 async function runDiagnostics(){
  if(!session){setAuthOpen(true);return;}
  setDiagnosticsBusy(true);
  try{setDiagnostics(await connectionChecks(session.user.id));}
  catch(e){notify(makeError(e),true);}finally{setDiagnosticsBusy(false);}
 }
 const pageInfo=NAV.find(n=>n.id===page)!;
 return <div className="app-shell">
  <aside className={"sidebar"+(mobileNav?" sidebar-open":"")}>
   <div className="brand" onClick={()=>navigate("overview")} role="button" tabIndex={0}><span className="brand-mark">N</span><span className="brand-copy"><b>NEXUS</b><small>ANALYTICS <i>INTELLIGENCE</i></small></span></div>
   <div className="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
   <nav className="sidebar-nav" aria-label="Разделы платформы">{NAV.map(n=><button type="button" key={n.id} className={"nav-item"+(page===n.id?" active":"")} onClick={()=>navigate(n.id)}><n.icon size={18}/><span>{n.label}</span>{page===n.id&&<span className="nav-current"/>}</button>)}</nav>
   <div className="sidebar-footer"><div className="engine-state"><span className="pulse"/><span>RESEARCH ENGINE v2.0</span></div><p>Единая архитектура · Supabase STAGING</p></div>
  </aside>
  {mobileNav&&<button className="drawer-mask" aria-label="Закрыть меню" onClick={()=>setMobileNav(false)}/>}
  <div className="app-main">
   <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Открыть меню"><Menu size={21}/></button><span className="breadcrumb">Платформа</span><ChevronRight size={13}/><b>{pageInfo.short}</b></div><div className="topbar-right"><span className="top-status"><span className={"status-dot"+(cloud?"":" offline")}/>{session?"Облако подключено":cloud?"Гостевой режим":"Не настроено"}</span><button className="top-icon" onClick={()=>void load()} disabled={!session||loading} title="Обновить"><RefreshCw size={17} className={loading?"spinning":""}/></button><button className="profile" onClick={()=>session?navigate("settings"):setAuthOpen(true)} title={session?.user.email||"Войти"}>{session?.user.email?.charAt(0).toUpperCase()||<LogIn size={18}/>}</button></div></header>
   <main className="content">
    {notice&&<div className={"notice"+(notice.error?" notice-error":"")} role="status"><span>{notice.error?<CircleAlert size={17}/>:<CheckCircle2 size={17}/>}</span>{notice.message}<button onClick={()=>setNotice(null)} aria-label="Закрыть"><X size={14}/></button></div>}
    {demo&&<div className="demo-banner"><span><Sparkles size={16}/> <b>ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ</b> — все компании, цены и события на экране вымышлены</span><button onClick={()=>session?setDemo(false):setAuthOpen(true)}>{session?"Перейти к моим данным":"Войти и начать"}<ArrowRight size={14}/></button></div>}
    {session&&!demo&&<div className="workspace-line"><span><Cloud size={14}/> Персональная база Supabase, данные защищены RLS</span><button onClick={()=>setDemo(true)}>Показать демо</button></div>}
    {page==="overview"&&<>
      <div className="hero"><div className="hero-copy"><div className="hero-eyebrow"><span className="hero-signal"/>NEXUS / RESEARCH OS / v2.0</div><h1>Сведения превращаются<br/>в <em>точные решения.</em></h1><p>Проверяй компании, закупки, судебные дела, продукцию и цены на рынке в одной системе. Каждый вывод — со статусом достоверности и источником.</p><div className="hero-actions"><Action variant="gold" icon={Search} onClick={()=>navigate("companies")}>Исследовать компанию</Action><Action variant="ghost" icon={FileUp} onClick={()=>navigate("import")}>Загрузить данные</Action></div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-center"><span className="orbit-n">N</span><span>INTELLIGENCE</span></div><div className="orbit-tag orbit-tag-a"><Building2 size={15}/> BUSINESS</div><div className="orbit-tag orbit-tag-b"><Scale size={15}/> LEGAL</div><div className="orbit-tag orbit-tag-c"><TrendingUp size={15}/> MARKET</div></div></div>
      <PageHead eyebrow="CONTROL CENTER" title="Обзор системы" description="Единая панель фактов и сигналов. Показатели отражают только текущую выборку." action={<Action icon={RefreshCw} onClick={()=>void load()} disabled={!session||demo}>Синхронизация</Action>}/>
      <div className="stats-grid"><Stat title="Компании" value={stats.companies} note="В доступном каталоге" icon={Building2}/><Stat title="Товары" value={stats.products} note="Включая сведения о наличии" icon={Package}/><Stat title="Заключённые договоры" value={stats.contracts} note="Из добавленных записей" icon={FileText}/><Stat title="Судебные записи" value={stats.cases} note="Без оценки нарушения" icon={Scale}/></div>
      <div className="dashboard-grid">
       <Section title="Закупочная активность" info="Три независимых вида событий" action={<button className="text-action" onClick={()=>navigate("tenders")}>Вся аналитика <ArrowUpRight size={14}/></button>}><div className="activity-list">{[{label:"Участие",count:stats.participation,className:"activity-blue"},{label:"Заявленные победы",count:stats.declaredWins,className:"activity-gold"},{label:"Договоры",count:stats.contracts,className:"activity-teal"}].map(x=><div className="activity-item" key={x.label}><div className="activity-label"><span>{x.label}</span><b>{x.count}</b></div><div className="bar-track"><div className={"bar-fill "+x.className} style={{width:Math.max(5,100*x.count/Math.max(1,stats.participation,stats.declaredWins,stats.contracts))+"%"}}/></div></div>)}</div><p className="panel-caveat">Договор не доказывает победу, а отсутствие записи — отсутствие участия.</p></Section>
       <Section title="Обновления источников" info="Реальное состояние доступных подключений" action={<button className="text-action" onClick={()=>navigate("sources")}>Все реестры <ArrowUpRight size={14}/></button>}><div className="sources-mini">{(providers.length?providers.slice(0,4):SOURCE_LINKS.slice(0,4)).map(p=><div className="source-mini" key={p.id}><span className="source-icon"><Database size={15}/></span><div><b>{p.name}</b><small>{"status" in p?providerStatus(p.status):"Статус загружается"}</small></div><span className="source-indicator"/></div>)}</div></Section>
      </div>
      <div className="bottom-grid"><Section title="Организации в каталоге" info={demo?"Учебные примеры без связи с реестром":"Ваши сохранённые компании"} action={<button className="text-action" onClick={()=>navigate("companies")}>Открыть <ArrowUpRight size={14}/></button>}>{current.companies.length?<div className="compact-list">{current.companies.slice(0,4).map((c,i)=><button className="compact-company" key={c.id} onClick={()=>{setCompanyId(c.id);navigate("companies");}}><span className="company-letter">{c.name.replace(/[^А-ЯA-Z]/g,"").slice(0,1)||String(i+1)}</span><span><b>{c.name}</b><small>{c.region||"Регион не указан"}</small></span><ChevronRight size={16}/></button>)}</div>:<Empty icon={Building2} title="Каталог пуст" detail="Найди организацию по ИНН или загрузи CSV/ЕГРЮЛ." action={<Action onClick={()=>navigate("companies")}>Найти организацию</Action>}/>}</Section><Section title="Контроль качества данных" info="Прозрачный статус каждой записи"><div className="quality-score"><span>{current.companies.filter(x=>x.verification_status==="official_verified").length}</span><div><b>Карточек подтверждено официально</b><small>Непроверенные сведения не подменяют данные реестра</small></div><ShieldCheck size={24}/></div><div className="quality-list"><div><span>Сведения по рынку</span><b>{current.offers.length}</b></div><div><span>Сигналы связей</span><b>{current.relations.length}</b></div><div><span>Общая сумма договорных записей</span><b>{money(stats.contractSum)}</b></div></div></Section></div>
    </>}
    {page==="companies"&&<>
     <PageHead eyebrow="BUSINESS INTELLIGENCE" title="Компании и контрагенты" description="Поиск по ИНН, официальные реквизиты, история закупок, дела, продукция и связи." action={<Action variant="primary" icon={Plus} onClick={()=>startForm("company")}>Добавить компанию</Action>}/>
     <div className="search-panel"><div className="search-panel-copy"><span className="eyebrow">ПРОВЕРКА ПО ИНН</span><h2>Найти организацию в доступных источниках</h2><p>Подтверждённые банковские карточки получаем через сервер NEXUS из Банка России. Остальные источники отмечаем отдельно.</p></div><div className="company-search-form"><label><span>ИНН</span><input inputMode="numeric" value={searchInn} onChange={e=>setSearchInn(e.target.value.replace(/\D/g,"").slice(0,12))} placeholder="10 или 12 цифр"/></label><label><span>ОГРН (необязательно)</span><input inputMode="numeric" value={searchOgrn} onChange={e=>setSearchOgrn(e.target.value.replace(/\D/g,"").slice(0,13))} placeholder="Для банков по ОГРН"/></label><Action variant="primary" icon={Search} disabled={researchBusy} onClick={()=>void runResearch()}>{researchBusy?"Проверяем…":"Начать проверку"}</Action></div><div className="quick-tests"><span>Живые примеры:</span>{[{name:"Сбербанк",inn:"7707083893",ogrn:""},{name:"ВТБ",inn:"7702070139",ogrn:""},{name:"Альфа-Банк",inn:"7728168971",ogrn:""},{name:"Газпромбанк",inn:"7744001497",ogrn:"1027700167110"}].map(x=><button key={x.inn} onClick={()=>void runResearch(x.inn,x.ogrn)}>{x.name}<ArrowUpRight size={12}/></button>)}</div></div>
     {searchResult&&<Section title="Результат автоматического поиска" info="Факты и совпадения поискового индекса отображаются отдельно." action={<Action onClick={()=>setSearchResult(null)}>Закрыть</Action>}>{searchResult.official?<div className="official-card"><div className="official-header"><Badge tone="positive"><CheckCircle2 size={13}/> Банк России · реквизиты подтверждены</Badge><InlineLink url={searchResult.official.sourceUrl}>Первоисточник</InlineLink></div><h3>{searchResult.official.name}</h3><div className="official-details"><div><small>ИНН</small><strong>{searchResult.official.inn}</strong></div><div><small>ОГРН</small><strong>{searchResult.official.ogrn}</strong></div><div><small>Статус</small><strong>{searchResult.official.status}</strong></div><div><small>Регион</small><strong>{searchResult.official.region||"Не определён"}</strong></div></div><div className="official-actions"><Action variant="primary" icon={Plus} onClick={()=>void saveOfficial(searchResult.official!)} disabled={saving}>Сохранить в каталог</Action><span>Проверка реквизитов не подтверждает тендеры, продукцию или суды</span></div></div>:<div className="hint"><CircleAlert size={18}/>Официальная карточка не подтверждена в подключённом источнике. Это не означает, что организация отсутствует в ФНС.</div>}{searchResult.groups&&Object.entries(searchResult.groups).some(([,g])=>g.results?.length>0)&&<div className="search-links"><h4>Веб-публикации — неофициальные совпадения</h4>{Object.entries(searchResult.groups).flatMap(([kind,g])=>(g.results||[]).slice(0,3).map(x=><div key={kind+x.url}><Badge>{kind}</Badge><InlineLink url={x.url}>{x.title}</InlineLink></div>))}</div>}</Section>}
     <Section title="Каталог организаций" info={demo?"Учебная демонстрация — не реальные компании":"Сведения из вашей базы"}><div className="inline-filter"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, ИНН, регион…"/><span>{current.companies.length} записей</span></div>{current.companies.filter(c=>(c.name+" "+c.inn+" "+c.region).toLowerCase().includes(query.toLowerCase())).length?<div className="company-grid">{current.companies.filter(c=>(c.name+" "+c.inn+" "+c.region).toLowerCase().includes(query.toLowerCase())).map(c=><button className={"company-tile"+(companyId===c.id?" selected":"")} key={c.id} onClick={()=>setCompanyId(c.id)}><span className="company-tile-top"><span className="tile-symbol"><Building2 size={20}/></span><SourceBadge status={c.verification_status}/></span><b>{c.name}</b><small>ИНН {c.inn}</small><span className="tile-meta">{c.region||"Регион не указан"}<ChevronRight size={16}/></span></button>)}</div>:<Empty icon={Building2} title="Компания не найдена" detail="Уточни поиск либо добавь новую организацию."/>}</Section>
     {selectedCompany&&<Section title={"Досье: "+selectedCompany.name} info="Связанные документы и сведения только из доступной базы" action={<><Action icon={Plus} onClick={()=>startForm("company",selectedCompany as unknown as Record<string,unknown>)}>Редактировать</Action><Action variant="ghost" onClick={()=>void removeRow("company",selectedCompany.id)}>Удалить</Action></>}><div className="detail-bento"><div><small>ИНН</small><b>{selectedCompany.inn}</b></div><div><small>ОГРН</small><b>{selectedCompany.ogrn||"—"}</b></div><div><small>Регион</small><b>{emptyText(selectedCompany.region)}</b></div><div><small>Источник</small><InlineLink url={selectedCompany.source_url}>Открыть документ</InlineLink></div></div><div className="dossier-metrics">{(()=>{const scope=companyScope(current,selectedCompany.id);return [{label:"Товаров",value:scope.products.length,where:"products" as Page},{label:"Закупочных событий",value:scope.tenders.length,where:"tenders" as Page},{label:"Судебных записей",value:scope.cases.length,where:"courts" as Page},{label:"Сигналов связей",value:scope.relations.length,where:"relations" as Page}].map(x=><button key={x.label} onClick={()=>navigate(x.where)}><strong>{x.value}</strong><span>{x.label}</span><ArrowUpRight size={15}/></button>)})()}</div><div className="dossier-tools"><Action variant="primary" onClick={()=>{setProductId("");navigate("products");}}>Продукция компании</Action><Action onClick={()=>navigate("tenders")}>История закупок</Action><Action onClick={()=>navigate("courts")}>Судебные записи</Action></div></Section>}
    </>}
    {page==="products"&&<>
     <PageHead eyebrow="PRODUCT INTELLIGENCE" title="Продукция и остатки" description="Товарные карточки поставщиков, наличие продукции и переход к сравнению рыночных предложений." action={<Action icon={Plus} variant="primary" onClick={()=>startForm("product")}>Добавить товар</Action>}/>
     <Section title="Каталог продукции" info={demo?"Вымышленные учебные товары":"Данные поставщиков из вашей базы"}><div className="inline-filter"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, артикул, категория…"/><span>{current.products.length} позиций</span></div>{current.products.length?<div className="product-grid">{current.products.filter(p=>(p.name+" "+p.category+" "+p.sku).toLowerCase().includes(query.toLowerCase())).map(p=><article className="product-tile" key={p.id}><div className="product-art"><Package size={34}/><span className="product-art-glow"/></div><div className="product-body"><Badge tone={p.availability==="in_stock"?"positive":p.availability==="on_request"?"gold":"muted"}>{statusName(p.availability)}</Badge><h3>{p.name}</h3><p>{lookup(p.company_id)}</p><div className="product-meta"><span>{p.category||"Без категории"}</span><b>{p.stock_qty===null?"Остаток неизвестен":p.stock_qty+" "+p.unit}</b></div><div className="product-buttons"><Action variant="primary" icon={TrendingUp} onClick={()=>{setSelectedProduct(p.id);navigate("market");}}>Анализ продукции</Action><button className="icon-only" onClick={()=>startForm("product",p as unknown as Record<string,unknown>)} title="Редактировать"><Settings2 size={17}/></button></div></div></article>)}</div>:<Empty icon={Package} title="Пока нет товаров" detail="Добавь продукцию компании или импортируй список в CSV." action={<Action onClick={()=>navigate("import")}>Импорт продукции</Action>}/>}</Section>
    </>}
    {page==="tenders"&&<>
     <PageHead eyebrow="PROCUREMENT INTELLIGENCE" title="Закупки и договоры" description="Участие ≠ заявленная победа ≠ заключение договора. Каждое событие фиксируется отдельно." action={<Action variant="primary" icon={Plus} onClick={()=>startForm("tender")}>Добавить событие</Action>}/>
     <div className="caution"><ShieldCheck size={18}/><span>Только загруженные записи. Импортированный договор не доказывает победу в тендере. Источник и проверка обязательны для обоснованного вывода.</span></div>
     <div className="stats-grid"><Stat title="Участие" value={procurementSummary(current.tenders).participation} note="По данным выборки" icon={Layers3}/><Stat title="Заявленные победы" value={procurementSummary(current.tenders).wins} note="Не подтверждаются автоматически" icon={TrendingUp}/><Stat title="Договоры" value={procurementSummary(current.tenders).contracts} note="Отдельные записи" icon={FileText}/><Stat title="Сумма договоров" value={money(procurementSummary(current.tenders).totalContracts)} note="Только загруженные записи" icon={BarChart3}/></div>
     <Section title="История процедур" info="События сгруппированы по категориям — возможны несколько видов на один номер." action={<div className="select-wrap"><Filter size={15}/><select value={tenderKind} onChange={e=>setTenderKind(e.target.value)}><option value="all">Все события</option><option value="participation">Участие</option><option value="win">Победа</option><option value="contract">Договор</option><option value="other">Не определено</option></select></div>}>{current.tenders.filter(t=>!t.is_demo&&(tenderKind==="all"||t.event_type===tenderKind)).length?<div className="record-list">{current.tenders.filter(t=>!t.is_demo&&(tenderKind==="all"||t.event_type===tenderKind)).map(t=><div className="record" key={t.id}><div className="record-main"><div className="record-tags"><Badge tone={t.event_type==="contract"?"positive":t.event_type==="win"?"gold":"blue"}>{eventName(t.event_type)}</Badge><Badge>{t.law==="223-FZ"?"223-ФЗ":t.law==="44-FZ"?"44-ФЗ":"Не определён"}</Badge><SourceBadge status={t.verification_status}/></div><h3>{t.procedure_number}</h3><p>{lookup(t.company_id)} · {emptyText(t.customer)}</p><small><Clock3 size={13}/>{prettyDay(t.occurred_at)} · {money(t.amount)}</small></div><div className="record-actions"><InlineLink url={t.source_url}>Открыть источник</InlineLink><button onClick={()=>startForm("tender",t as unknown as Record<string,unknown>)}>Править</button></div></div>)}</div>:<Empty icon={FileText} title="Закупочных записей нет" detail="Загрузи XML-контракты ЕИС или добавь процедурные события вручную." action={<Action onClick={()=>navigate("import")}>Импортировать</Action>}/>}</Section>
    </>}
    {page==="courts"&&<>
     <PageHead eyebrow="LEGAL INTELLIGENCE" title="Судебная аналитика" description="Процессуальные роли, стадии, суммы требований и ссылки на документы." action={<Action variant="primary" icon={Plus} onClick={()=>startForm("case")}>Добавить дело</Action>}/>
     <div className="caution"><CircleAlert size={18}/><span>Наличие судебного дела не означает нарушения закона. Сумма исковых требований не является установленной задолженностью.</span></div>
     <div className="stats-grid"><Stat title="Истец" value={courtSummary(current.cases).plaintiff} note="Роль стороны" icon={FileText}/><Stat title="Ответчик" value={courtSummary(current.cases).defendant} note="Не показатель нарушения" icon={Scale}/><Stat title="Третье лицо" value={courtSummary(current.cases).thirdParty} note="Отдельная роль" icon={Users}/><Stat title="Сумма требований" value={money(courtSummary(current.cases).claimAmount)} note="Не равна задолженности" icon={BarChart3}/></div>
     <Section title="Реестр судебных записей" action={<div className="select-wrap"><Filter size={15}/><select value={courtRole} onChange={e=>setCourtRole(e.target.value)}><option value="all">Все роли</option><option value="plaintiff">Истец</option><option value="defendant">Ответчик</option><option value="third_party">Третье лицо</option><option value="unknown">Не определена</option></select></div>}>{current.cases.filter(c=>!c.is_demo&&(courtRole==="all"||c.role===courtRole)).length?<div className="record-list">{current.cases.filter(c=>!c.is_demo&&(courtRole==="all"||c.role===courtRole)).map(c=><div className="record" key={c.id}><div className="record-main"><div className="record-tags"><Badge tone={c.role==="defendant"?"warning":"blue"}>{roleName(c.role)}</Badge><SourceBadge status={c.verification_status}/></div><h3>{c.case_number}</h3><p>{lookup(c.company_id)} · {emptyText(c.court_name)}</p><small>{emptyText(c.stage)} · Требования: {money(c.claim_amount)} · {prettyDay(c.filed_at)}</small></div><div className="record-actions"><InlineLink url={c.source_url}>Документ дела</InlineLink><button onClick={()=>startForm("case",c as unknown as Record<string,unknown>)}>Править</button></div></div>)}</div>:<Empty icon={Scale} title="Записи отсутствуют" detail="Это не означает отсутствия судебных дел. Проверь официальный КАД." action={<Action onClick={()=>navigate("sources")}>Открыть источники</Action>}/>}</Section>
    </>}
    {page==="market"&&<>
     <PageHead eyebrow="MARKET INTELLIGENCE" title="Анализ рынка и цен" description="Сравнение сопоставимых товарных предложений с учётом даты, наличия и первоисточника." action={<Action variant="primary" icon={Plus} onClick={()=>startForm("offer")}>Добавить цену</Action>}/>
     <div className="market-head"><label className="market-picker"><span>Выбери продукцию для сравнения</span><select value={chosenProduct?.id||""} onChange={e=>{setSelectedProduct(e.target.value);setProductId(e.target.value);}}><option value="">Выбрать товар</option>{current.products.map(p=><option key={p.id} value={p.id}>{p.name} · {lookup(p.company_id)}</option>)}</select></label><div className="market-flag"><BarChart3 size={18}/> АНАЛИТИКА ВЫБОРКИ</div></div>
     {chosenProduct?(()=>{const offers=current.offers.filter(o=>o.product_id===chosenProduct.id);const ins=productInsight(chosenProduct,offers);const maxPrice=Math.max(1,...offers.map(o=>o.unit_price));return <><div className="stats-grid"><Stat title="Предложений" value={ins.sampleSize} note="Только в выборке" icon={Layers3}/><Stat title="Минимальная цена" value={money(ins.minimum)} note="При сопоставимости" icon={TrendingUp}/><Stat title="Медиана" value={money(ins.median)} note="Без экстремальных оценок" icon={BarChart3}/><Stat title="В наличии" value={ins.inStock} note="Указано поставщиками" icon={Package}/></div><Section title="Сравнение предложений" info="Рублей за единицу; неизвестные цены и другие валюты не смешиваются" action={<button className="text-action" onClick={()=>csvExport(["Продавец","Цена","Наличие","Дата","Источник"],offers.map(o=>[o.seller_name,o.unit_price,o.stock_status,o.observed_at,o.source_url]),"nexus-market.csv")}>Экспорт CSV <ArrowDownToLine size={15}/></button>}><div className="price-chart">{offers.length?offers.slice().sort((a,b)=>a.unit_price-b.unit_price).map(o=><div className="price-row" key={o.id}><span className="price-seller">{o.seller_name}<small>{statusName(o.stock_status)} · {prettyDay(o.observed_at)}</small></span><div className="price-track"><div style={{width:Math.max(5,100*o.unit_price/maxPrice)+"%"}}/></div><strong>{money(o.unit_price)}</strong><button className="tiny-edit" onClick={()=>startForm("offer",o as unknown as Record<string,unknown>)}>Изменить</button></div>):<Empty icon={BarChart3} title="Предложений пока нет" detail="Добавь цены конкурентов для рыночного сравнения."/>}</div><div className="caution"><CircleAlert size={17}/><span>{ins.caveat} Наличие — заявление поставщика, не проверенный складской остаток.</span></div></Section></>})():<Empty icon={Package} title="Выбери товар" detail="Добавь продукцию компании, затем собирай и сравнивай коммерческие предложения." action={<Action onClick={()=>navigate("products")}>Каталог продукции</Action>}/>}
    </>}
    {page==="relations"&&<>
      <PageHead eyebrow="RELATIONSHIP INTELLIGENCE" title="Связи и аффилированность" description="Признаки пересечений адресов, руководителей и контактов; каждое совпадение требует доказательной проверки." action={<Action variant="primary" icon={Plus} onClick={()=>startForm("relation")}>Добавить сигнал</Action>}/>
      <div className="caution"><Network size={19}/><span>Сигнал связи не равен доказанной аффилированности. Общий адрес бизнес-центра сам по себе ничего не доказывает.</span></div>
      <Section title="Карта связей компаний" info="Связи формируются только из сохранённых вами признаков">{current.relations.length?<div className="relations-grid">{relationSignals(current.relations,current.companies).map(r=><div className="relation-card" key={r.id}><div className="relation-pair"><span>{r.left}</span><span className="relation-line"><Link2 size={17}/></span><span>{r.right}</span></div><Badge tone="gold">Сигнал: {({director:"Руководитель",address:"Адрес",phone:"Телефон",email:"Email",founder:"Учредитель",other:"Другое"} as Record<string,string>)[r.signal_type]}</Badge><p>{r.signal_value||"Значение не указано"}</p><small>{r.conclusion}</small><div className="relation-actions"><InlineLink url={r.source_url}>Источник</InlineLink><button onClick={()=>startForm("relation",r as unknown as Record<string,unknown>)}>Редактировать</button></div></div>)}</div>:<Empty icon={Network} title="Пока нет зафиксированных сигналов" detail="Добавь сведения о совпадениях с их подтверждающими источниками."/>}</Section>
    </>}
    {page==="sources"&&<>
      <PageHead eyebrow="DATA INFRASTRUCTURE" title="Источники и интеграции" description="Здесь показана реальная доступность сервисов. Ссылка на сайт не считается интеграцией с API." action={<Action icon={RefreshCw} onClick={()=>void getProviders().then(setProviders).catch(e=>setProvidersError(makeError(e)))}>Проверить доступность</Action>}/>
      <div className="source-summary"><div><Cloud size={23}/><b>{providers.length}</b><span>Источников в реестре сервера</span></div><div><ShieldCheck size={23}/><b>{providers.filter(p=>p.status==="live_partial").length}</b><span>Частично автоматизированы</span></div><div><LockKeyhole size={23}/><b>{providers.filter(p=>p.status==="credentials_required"||p.status==="licensed_or_manual").length}</b><span>Требуют доступа</span></div></div>
      {providersError&&<div className="caution"><CircleAlert size={17}/>Не удалось получить статусы: {providersError}</div>}
      <Section title="Реестр коннекторов" info="Статусы поступают от NEXUS Research Engine. Состояние бизнес-данных требует отдельной проверки."><div className="inline-filter"><Filter size={17}/><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">Все подключения</option><option value="live_partial">Частичный API</option><option value="manual">Ручная проверка</option><option value="credentials_required">Требуется доступ</option><option value="licensed_or_manual">API / лицензия</option></select><span>{providers.length} источников</span></div><div className="provider-grid">{(providers.length?providers:SOURCE_LINKS.map(x=>({...x,status:"unknown",reason:"Статус сервера не загружен"}))).filter(p=>sourceFilter==="all"||p.status===sourceFilter).map(p=><div className="provider-card" key={p.id}><div className="provider-title"><span><Database size={18}/></span><Badge tone={p.status==="live_partial"?"positive":"warning"}>{providerStatus(p.status)}</Badge></div><h3>{p.name}</h3><p>{p.reason||("summary" in p?p.summary:"")}</p><InlineLink url={p.url}>Открыть источник</InlineLink></div>)}</div></Section>
    </>}
    {page==="import"&&<>
      <PageHead eyebrow="DATA PIPELINE" title="Импорт и нормализация" description="CSV и ограниченный XML ЕГРЮЛ/ЕГРИП / договоров. Единая проверка идентификаторов, источника и структуры."/>
      <div className="import-layout"><div className="import-left"><Section title="Загрузить данные" info="Файл читается на устройстве. Сохранение в облако — только после предварительной проверки."><label className="form-field"><span>Тип данных для CSV</span><select value={importType} onChange={e=>{setImportType(e.target.value as ImportPreview["type"]);setPreview(null);}}><option value="companies">Компании</option><option value="products">Продукция</option><option value="tenders">Закупки</option><option value="cases">Судебные записи</option></select></label><label className="file-drop"><FileUp size={26}/><b>Выбери файл из «Файлы»</b><span>CSV (UTF-8), XML ФНС или контрактов · до 2 МБ</span><input type="file" accept=".csv,.xml,text/csv,application/xml,text/xml" onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value="";}}/></label><Action icon={ArrowDownToLine} onClick={()=>fileSave(sampleCsv(importType),"nexus-template-"+importType+".csv")}>Скачать CSV-шаблон</Action><div className="pipeline-steps">{["Выбор файла","Проверка ИНН и полей","Предварительный просмотр","Подтверждённая запись в STAGING"].map((step,i)=><div key={step}><span>{String(i+1).padStart(2,"0")}</span>{step}</div>)}</div></Section></div>
      <div className="import-right"><Section title="Предварительный просмотр" info="Ни одна запись не добавляется без подтверждения">{preview?<><div className="import-stats"><div><b>{preview.total}</b><small>Строк</small></div><div><b>{preview.items.length}</b><small>Корректных</small></div><div><b>{preview.errors.length}</b><small>Ошибок</small></div></div><p className="import-detail">{preview.info}</p>{preview.items.slice(0,3).map((x,i)=><div className="preview-item" key={i}>{String(x.name||x.procedure_number||x.case_number||"Запись")}<small>{String(x.inn||x.companyInn||"")} · НЕ ПОДТВЕРЖДЕНО</small></div>)}{preview.errors.slice(0,5).map((x,i)=><p className="import-error" key={i}>{x}</p>)}<div className="import-actions"><Action variant="primary" icon={CheckCircle2} onClick={()=>void commitImport()} disabled={importBusy||!preview.items.length}>{importBusy?"Загружаем…":"Подтвердить импорт"}</Action><Action onClick={()=>setPreview(null)}>Отменить</Action></div></>:<Empty icon={FileUp} title="Файл ещё не загружен" detail="Выбери файл, чтобы увидеть результаты проверки до сохранения."/>}</Section><div className="caution"><ShieldCheck size={18}/><span>Обработанный файл не подтверждает происхождение из ФНС или ЕИС. Электронные подписи и полнота выгрузки требуют независимой проверки.</span></div></div></div>
    </>}
    {page==="settings"&&<>
     <PageHead eyebrow="PLATFORM CONFIGURATION" title="Состояние системы" description="Проверки реальной связи с Supabase, доступа к данным и возможностей интеграций."/>
     <div className="settings-grid"><Section title="Тестовый аккаунт" info="Персональная база, без публикации данных других пользователей"><div className="settings-user"><div className="settings-avatar">{session?.user.email?.slice(0,1).toUpperCase()||"N"}</div><div><b>{session?.user.email||"Гостевой доступ"}</b><small>{session?"Авторизован в Supabase STAGING":"Войдите для сохранения данных"}</small></div></div><div className="settings-actions">{session?<Action icon={LogOut} onClick={()=>void cloud?.auth.signOut()}>Выйти</Action>:<Action variant="primary" icon={LogIn} onClick={()=>setAuthOpen(true)}>Войти / создать аккаунт</Action>}<Action onClick={()=>setDemo(!demo)}>{demo?"Открыть реальную базу":"Просмотр ДЕМО"}</Action></div></Section><Section title="Живая диагностика" info="Не имитирует успех; проверяет действительные ответы сервера"><div className="diagnostic-list">{diagnostics?.map(x=><div className="diag" key={x.name}>{x.ok?<CheckCircle2 color="#2D8C71" size={16}/>:<CircleAlert color="#B47B47" size={16}/>}<span><b>{x.name}</b><small>{x.message}</small></span></div>)||<p className="muted-p">Проверки не запускались.</p>}</div><Action icon={RefreshCw} onClick={()=>void runDiagnostics()} disabled={diagnosticsBusy}>{diagnosticsBusy?"Проверка…":"Проверить пять подключений"}</Action></Section></div>
     <Section title="Правила обработки данных" info="Дизайн для эксплуатации в закупках и договорной работе"><div className="rules-grid">{[{icon:ShieldCheck,title:"Разделение данных",text:"Каждый пользователь видит только свои записи благодаря RLS."},{icon:Database,title:"Один источник истины",text:"Компании и их документы хранятся в связанных таблицах Supabase."},{icon:Activity,title:"Доказательная аналитика",text:"Победа, договор, судебное требование и связь не приравниваются друг к другу."},{icon:Link2,title:"Интеграции без секретов",text:"Сервисные ключи не передаются в браузер; коммерческие API без доступа отключены."}].map(x=><div className="rule" key={x.title}><x.icon size={20}/><h3>{x.title}</h3><p>{x.text}</p></div>)}</div></Section>
    </>}
    <footer className="main-footer"><span>NEXUS ANALYTICS © 2026 · v2.0 STAGING</span><span>Проверяйте первоисточники перед принятием решений</span></footer>
   </main>
  </div>
  <nav className="mobile-tabs" aria-label="Быстрая навигация">{NAV.slice(0,4).map(n=><button key={n.id} className={page===n.id?"active":""} onClick={()=>navigate(n.id)}><n.icon size={19}/><span>{n.short}</span></button>)}<button className={NAV.slice(4).some(n=>n.id===page)?"active":""} onClick={()=>setMobileNav(true)}><Menu size={19}/><span>Ещё</span></button></nav>
  {form&&<div className="modal-overlay" role="presentation" onClick={()=>setForm(null)}><div className="dialog" role="dialog" aria-modal="true" aria-label={"Форма: "+KIND_TITLE[form.kind]} onClick={e=>e.stopPropagation()}><div className="dialog-head"><div><div className="eyebrow">NEXUS / DATA ENTRY</div><h2>{form.id?"Редактировать: ":"Добавить: "}{KIND_TITLE[form.kind]}</h2></div><button onClick={()=>setForm(null)} aria-label="Закрыть"><X size={20}/></button></div><form onSubmit={e=>void submitForm(e)}><div className="form-grid">{FormFields(form.kind,data).map(f=><Field key={f.key} field={f} value={draft[f.key]||""} onChange={value=>setDraft({...draft,[f.key]:value})}/>)}</div><p className="form-hint"><ShieldCheck size={15}/> Сведения без подтверждённого первоисточника сохраняются как непроверенные.</p><div className="dialog-footer"><Action onClick={()=>setForm(null)}>Отмена</Action><button type="submit" className="action action-primary" disabled={saving}>{saving?"Сохраняем…":"Сохранить"}</button></div></form></div></div>}
  {authOpen&&<div className="modal-overlay" role="presentation" onClick={()=>setAuthOpen(false)}><div className="dialog auth-dialog" role="dialog" aria-modal="true" aria-label="Вход в NEXUS" onClick={e=>e.stopPropagation()}><div className="dialog-head"><div><div className="eyebrow">SECURE ACCESS</div><h2>{authSignup?"Создать аккаунт":"Войти в NEXUS"}</h2></div><button onClick={()=>setAuthOpen(false)} aria-label="Закрыть"><X size={20}/></button></div><p className="auth-description">Единая тестовая база Supabase. Ваши данные защищены на уровне строк (RLS).</p><form onSubmit={e=>void authSubmit(e)} className="auth-form"><label className="form-field"><span>Email</span><input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} autoComplete="email"/></label><label className="form-field"><span>Пароль</span><input type="password" required minLength={6} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} autoComplete={authSignup?"new-password":"current-password"}/></label><button type="submit" className="action action-primary" disabled={authBusy}>{authBusy?"Подключаем…":authSignup?"Зарегистрироваться":"Войти"}</button></form><button className="auth-toggle" onClick={()=>setAuthSignup(!authSignup)}>{authSignup?"Уже есть аккаунт? Войти":"Нет аккаунта? Создать тестовый"}</button></div></div>}
 </div>;
}
