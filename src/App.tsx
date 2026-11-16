import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Bell,
  BookOpenCheck, BriefcaseBusiness, Building2, ChartNoAxesCombined, Check, ChevronDown,
  ChevronRight, CircleAlert, Database, FileDown, FileSearch, FileUp, Filter, Globe2,
  Layers3, LayoutDashboard, Link2, LockKeyhole, LogOut, Menu, Network,
  Package, Plus, RefreshCw, Scale, Search, ShieldCheck, SlidersHorizontal, Sparkles, X
} from "lucide-react";
import { EntityForm } from "./components/EntityForm";
import { IntegrationHealthPanel } from "./components/IntegrationHealthPanel";
import { ResearchPanel, type OfficialCompany } from "./components/ResearchPanel";
import { automaticSignals, companyContext, companyName, marketStats, procurementMetrics, productOffers, relationLabel, summary } from "./lib/analytics";
import { parseCsv, field as csvField } from "./lib/csv";
import { fromXml } from "./lib/importers";
import { prepareXmlImport } from "./lib/intake";
import type { ImportPreview as XmlPreview } from "./types";
import { insertRow, loadWorkspace } from "./lib/data";
import { DEMO } from "./lib/demo";
import { configured, researchEndpoint, supabase } from "./lib/supabase";
import type { EntityKind, EvidenceStatus, View, Workspace } from "./lib/types";
import { EMPTY_WORKSPACE } from "./lib/types";
import { currency, dateLabel, downloadCsv, safeHttpUrl, toCsv, validInn } from "./lib/validation";

type Provider = { id:string; name:string; status:string; scope:string; reason:string; url:string };
const menu:{id:View;name:string;icon:typeof LayoutDashboard}[]=[
 {id:"overview",name:"Обзор",icon:LayoutDashboard},{id:"companies",name:"Компании",icon:Building2},
 {id:"products",name:"Товары и цены",icon:Package},{id:"procurements",name:"Закупки",icon:BriefcaseBusiness},
 {id:"courts",name:"Судебные дела",icon:Scale},{id:"relations",name:"Связи компаний",icon:Network},
 {id:"sources",name:"Источники данных",icon:Database},{id:"imports",name:"Импорт",icon:FileUp}
];
const kindLabels:{[K in EntityKind]:string}={company:"Компания",product:"Продукция",procurement:"Закупочная запись",court:"Судебное дело",offer:"Ценовое предложение"};
const statuses:Record<EvidenceStatus,string>={unverified:"Не проверено",source_linked:"Ссылка на источник",user_verified:"Сверено пользователем",official_verified:"Официально подтверждено"};
const fallbackProviders:Provider[]=[
{id:"cbr",name:"Банк России",status:"live_partial",scope:"Финансовые организации",reason:"Реальный поиск карточек отдельных банков по ИНН и ОГРН.",url:"https://www.cbr.ru/finorg/"},
{id:"fns",name:"ФНС / ЕГРЮЛ",status:"manual",scope:"Регистрация, руководство и ОКВЭД",reason:"Официальный портал; полный автоматический доступ отдельно.",url:"https://egrul.nalog.gov.ru/"},
{id:"eis",name:"ЕИС",status:"credentials_required",scope:"44-ФЗ и 223-ФЗ",reason:"Нужен разрешённый интеграционный доступ к реестрам.",url:"https://zakupki.gov.ru/"},
{id:"kad",name:"КАД Арбитр",status:"licensed_or_manual",scope:"Арбитражные дела",reason:"Прямой официальный массовый API не подключён.",url:"https://kad.arbitr.ru/"}
];
function Evidence({status,source}:{status?:EvidenceStatus;source?:string|null}){
 const value=status==="official_verified"?"official":status==="user_verified"?"verified":status==="source_linked"?"linked":"unknown";
 return <span className={"evidence "+value}>{value==="official"?<BadgeCheck size={12}/>:value==="verified"?<Check size={12}/>:value==="linked"?<Link2 size={12}/>:<CircleAlert size={12}/>} {statuses[status||"unverified"]}{source&&!safeHttpUrl(source)?" · URL недействителен":""}</span>;
}
function Metric({label,value,sub,icon:Icon,trend}:{label:string;value:string|number;sub:string;icon:typeof LayoutDashboard;trend?:string}){
 return <div className="metric"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={18}/></span></div><div className="metric-num">{value}</div><div className="metric-bottom">{trend&&<strong>{trend}</strong>}{sub}</div></div>;
}
function Empty({heading,copy}:{heading:string;copy:string}){return <div className="empty-state"><div className="empty-ill"><Layers3 size={28}/></div><h3>{heading}</h3><p>{copy}</p></div>}
function SectionTop({kicker,title,subtitle,action}:{kicker:string;title:string;subtitle:string;action?:React.ReactNode}){
 return <div className="section-heading"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function SourceLink({url}:{url?:string|null}){const safe=safeHttpUrl(url);return safe?<a className="source-link" target="_blank" rel="noopener noreferrer" href={safe}>Источник <ArrowUpRight size={14}/></a>:<span className="missing-source">Источник не указан</span>}
function MiniColumns({values}:{values:number[]}){const mx=Math.max(1,...values);return <div className="mini-bars">{values.map((v,i)=><div key={i} className={"mini-bar b"+i%3} style={{height:String(Math.max(7,v/mx*100))+"%"}}/>)}</div>}

export default function App(){
 const [view,setView]=useState<View>("overview");
 const [user,setUser]=useState<User|null>(null);
 const [mode,setMode]=useState<"demo"|"cloud">("demo");
 const [workspace,setWorkspace]=useState<Workspace>(EMPTY_WORKSPACE);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState<EntityKind|null>(null);
 const [authOpen,setAuthOpen]=useState(false);
 const [authMode,setAuthMode]=useState<"signin"|"signup">("signin");
 const [authError,setAuthError]=useState("");
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 const [toast,setToast]=useState("");
 const [companyQuery,setCompanyQuery]=useState("");
 const [selectedCompany,setSelectedCompany]=useState("");
 const [selectedProduct,setSelectedProduct]=useState("");
 const [procFilter,setProcFilter]=useState("all");const [courtFilter,setCourtFilter]=useState("all");
 const [providers,setProviders]=useState<Provider[]>([]);
 const [providerError,setProviderError]=useState("");
 const [mobileNav,setMobileNav]=useState(false);
 const [importKind,setImportKind]=useState<EntityKind>("company");
 const [importRows,setImportRows]=useState<Record<string,string>[]>([]);
 const [importFilename,setImportFilename]=useState("");
 const [importErrors,setImportErrors]=useState<string[]>([]);
 const [xmlPreview,setXmlPreview]=useState<XmlPreview|null>(null);
 const dataset=mode==="demo"?DEMO:workspace;
 const metrics=useMemo(()=>summary(dataset),[dataset]);
 const isDemo=mode==="demo";
 const signedIn=Boolean(user);
 const signalPairs=useMemo(()=>automaticSignals(dataset.companies),[dataset.companies]);
 const proc=useMemo(()=>procurementMetrics(dataset.procurements.map(x=>isDemo?{...x,is_demo:false}:x)),[dataset.procurements,isDemo]);
 const pageTitle=menu.find(x=>x.id===view)?.name||"Обзор";

 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  void supabase.auth.getSession().then(({data})=>{if(!active)return;setUser(data.session?.user||null);if(data.session?.user)setMode("cloud");});
  const listener=supabase.auth.onAuthStateChange((_event,session)=>{if(!active)return;setUser(session?.user||null);if(session?.user)setMode("cloud");else setMode("demo");});
  return()=>{active=false;listener.data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{
  if(!user||mode!=="cloud")return;
  let active=true;setLoading(true);
  void loadWorkspace().then(data=>{if(active)setWorkspace(data)}).catch(e=>{if(active)notify(String(e))}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[user?.id,mode]);
 useEffect(()=>{
  if(!researchEndpoint.startsWith("https://"))return;
  let active=true;
  void fetch(researchEndpoint+"?mode=providers",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Источники недоступны");return r.json()})
  .then((d:{providers?:Provider[]})=>{if(active&&Array.isArray(d.providers))setProviders(d.providers)})
  .catch(()=>{if(active)setProviderError("Серверный реестр не ответил. Ниже — справочные статусы.")});
  return()=>{active=false};
 },[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),6000);return()=>clearTimeout(t)},[toast]);
 function notify(message:string){setToast(message.slice(0,260))}
 async function refresh(){
  if(!user||mode!=="cloud")return;
  setLoading(true);
  try{setWorkspace(await loadWorkspace());notify("Данные обновлены из Supabase")}catch(e){notify(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 }
 function openForm(kind:EntityKind){
  if(isDemo||!user){setAuthOpen(true);notify("В демо изменения не сохраняются. Войдите, чтобы работать со своей базой.");return;}
  if(kind!=="company"&&kind!=="offer"&&dataset.companies.length===0){setView("companies");notify("Сначала добавьте компанию");return;}
  if(kind==="offer"&&dataset.products.length===0){setView("products");notify("Сначала добавьте товар");return;}
  setForm(kind);
 }
 async function saveForm(kind:EntityKind,row:Record<string,unknown>){
  if(!user)throw new Error("Требуется авторизация");
  if(mode!=="cloud")throw new Error("Переключитесь в личную базу");
  setSaving(true);
  try{await insertRow(kind,user.id,row);setWorkspace(await loadWorkspace());notify(kindLabels[kind]+" добавлена");}
  finally{setSaving(false)}
 }
 async function handleAuth(){
  if(!supabase){setAuthError("Не настроен Supabase");return;}
  if(password.length<6){setAuthError("Пароль должен содержать не менее 6 символов");return;}
  setSaving(true);setAuthError("");
  try{
   const {error,data}=authMode==="signin"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});
   if(error)throw error;
   if(authMode==="signup"&&!data.session){setAuthError("Регистрация создана. Подтвердите email по письму, затем войдите.");return;}
   setAuthOpen(false);setPassword("");setMode("cloud");notify("Выполнен вход в NEXUS");
  }catch(e){setAuthError(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 async function logout(){
  await supabase?.auth.signOut();setMode("demo");setWorkspace(EMPTY_WORKSPACE);setAuthOpen(false);notify("Вы вышли из аккаунта");
 }
 async function saveOfficial(o:OfficialCompany){
  if(!user)throw new Error("Сначала войдите");
  if(!o.verified||!validInn(o.inn)||!safeHttpUrl(o.sourceUrl))throw new Error("Нельзя сохранить неподтверждённый результат");
  if(workspace.companies.some(x=>x.inn===o.inn)){notify("Компания с этим ИНН уже в базе");return;}
  await insertRow("company",user.id,{inn:o.inn,ogrn:o.ogrn,name:o.name,region:o.region||"",activity:"Финансовые услуги",website:safeHttpUrl(o.site),legal_address:o.address,source_url:o.sourceUrl,source_provider:"cbr",verification_status:"official_verified",checked_at:o.retrievedAt||new Date().toISOString()});
  setWorkspace(await loadWorkspace());notify("Реквизиты сохранены с подтверждением Банка России");
 }
 function goto(v:View){setView(v);setMobileNav(false);window.scrollTo({top:0,behavior:"smooth"})}
 function exportView(){
  let headers:string[]=[],rows:unknown[][]=[];
  if(view==="companies"){headers=["Наименование","ИНН","ОГРН","Регион","Отрасль","Источник","Проверка"];rows=dataset.companies.map(c=>[c.name,c.inn,c.ogrn,c.region,c.activity,c.source_url,c.verification_status])}
  else if(view==="products"){headers=["Товар","Компания","Категория","Наличие","Остаток"];rows=dataset.products.map(p=>[p.name,companyName(dataset,p.company_id),p.category,p.availability,p.stock_qty])}
  else if(view==="procurements"){headers=["Поставщик","Номер","Заказчик","Событие","Закон","Сумма","Дата","Источник"];rows=dataset.procurements.map(p=>[companyName(dataset,p.company_id),p.procedure_number,p.customer,p.event_type,p.law,p.amount,p.occurred_at,p.source_url])}
  else if(view==="courts"){headers=["Компания","Дело","Суд","Роль","Стадия","Требования (не долг)","Источник"];rows=dataset.courts.map(c=>[companyName(dataset,c.company_id),c.case_number,c.court_name,c.role,c.stage,c.claim_amount,c.source_url])}
  else{notify("Выберите раздел с данными");return;}
  downloadCsv("nexus-"+view+".csv",toCsv(headers,rows));notify("Экспортировано: "+rows.length+" строк"+(isDemo?" (УЧЕБНЫЕ)":""));
 }
 async function fileChosen(file:File|null){
  if(!file)return;
  setImportErrors([]);setImportRows([]);setXmlPreview(null);setImportFilename(file.name);
  if(file.size>1500000){setImportErrors(["Слишком большой файл (максимум 1,5 МБ)"]);return;}
  if(file.name.toLowerCase().endsWith(".xml")) {
   try{
    const bytes=new Uint8Array(await file.arrayBuffer());
    const declaration=new TextDecoder("iso-8859-1").decode(bytes.slice(0,260));
    const declared=(declaration.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
    let encoding=bytes[0]===255&&bytes[1]===254?"utf-16le":bytes[0]===254&&bytes[1]===255?"utf-16be":bytes[0]===239&&bytes[1]===187&&bytes[2]===191?"utf-8":declared||"utf-8";
    if(/^cp1251$/i.test(encoding))encoding="windows-1251";
    if(!/^(?:utf-8|utf8|utf-16|utf-16le|utf-16be|windows-1251)$/i.test(encoding))throw Error("Неподдерживаемая кодировка XML");
    const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
    const result=fromXml(text,file.name);
    setXmlPreview(result);
    setImportKind(result.type==="companies"?"company":result.type==="tenders"?"procurement":result.type==="cases"?"court":"product");
    setImportErrors(result.errors);
   }catch(e){setImportErrors([e instanceof Error?e.message:String(e)])}
   return;
  }
  if(!file.name.toLowerCase().endsWith(".csv")){setImportErrors(["Выберите CSV или XML"]);return;}
  try{const parsed=parseCsv(await file.text());setImportRows(parsed);}catch(e){setImportErrors([e instanceof Error?e.message:String(e)])}
 }
 function csvObject(r:Record<string,string>):{kind:EntityKind,row:Record<string,unknown>}{
  const f=(...names:string[])=>csvField(r,names);
  const url=f("источник","source","sourceurl","ссылка");
  if(url&&!safeHttpUrl(url))throw new Error("Некорректный URL источника");
  const source_url=url||null;
  if(importKind==="company"){
   const inn=f("инн","inn");if(!validInn(inn))throw new Error("Неверный ИНН");
   const name=f("название","наименование","name");if(!name)throw new Error("Нет названия");
   if(dataset.companies.some(c=>c.inn===inn))throw new Error("Компания уже существует в базе");
   return {kind:importKind,row:{inn,name,region:f("регион","region"),activity:f("отрасль","оквэд","activity"),director:f("руководитель","директор"),legal_address:f("адрес","legal_address"),source_url,source_provider:"csv",verification_status:"unverified"}};
  }
  if(importKind==="offer"){
   const productNameText=f("товар","product","названиетовара");
   const matches=dataset.products.filter(p=>p.name.toLowerCase()===productNameText.toLowerCase());
   if(matches.length!==1)throw new Error("Нужен один существующий товар по названию");
   const price=Number(f("цена","price","unit_price").replace(",","."));if(!Number.isFinite(price)||price<0)throw new Error("Цена не указана или некорректна");
   return {kind:importKind,row:{product_id:matches[0].id,seller_name:f("продавец","seller")||"Поставщик из файла",unit_price:price,currency:"RUB",stock_status:"unknown",observed_at:new Date().toISOString().slice(0,10),source_url,verification_status:"unverified"}};
  }
  const inn=f("инн","inn","иннпоставщика","иннучастника");
  const company=dataset.companies.find(c=>c.inn===inn);
  if(!company)throw new Error("Сначала добавьте компанию с ИНН "+inn);
  if(importKind==="product"){
   const name=f("товар","название","name");if(!name)throw new Error("Нет товара");
   return {kind:importKind,row:{company_id:company.id,name,category:f("категория","category"),unit:f("единица","unit")||"шт.",availability:"unknown",source_url}};
  }
  if(importKind==="procurement"){
   const number=f("номер","номерзакупки","number");if(!number)throw new Error("Нет номера закупки");
   const raw=f("событие","event_type","типсобытия").toLowerCase();
   const event_type=raw==="победа"||raw==="win"?"win":raw==="договор"||raw==="contract"?"contract":raw==="участие"||raw==="participation"?"participation":"other";
   const rawAmount=f("сумма","amount");
   const amount=rawAmount?Number(rawAmount.replace(",",".")):null;
   if(amount!==null&&(!Number.isFinite(amount)||amount<0))throw new Error("Неверная сумма");
   return {kind:importKind,row:{company_id:company.id,procedure_number:number,customer:f("заказчик","customer"),event_type,law:"unknown",amount,source_url,source_provider:"csv",verification_status:"unverified",is_demo:false}};
  }
  const number=f("номердела","дело","case_number");
  if(!number)throw new Error("Нет номера дела");
  return {kind:"court",row:{company_id:company.id,case_number:number,court_name:f("суд","court"),role:"unknown",stage:f("статус","stage")||"Не установлена",source_url,source_provider:"csv",verification_status:"unverified",is_demo:false}};
 }
 function importPreview(){
  if(xmlPreview){const ready=prepareXmlImport(xmlPreview,dataset);return {valid:ready.valid,errors:ready.errors};}
  const valid:{kind:EntityKind;row:Record<string,unknown>}[]=[];const errors:string[]=[];
  importRows.forEach((r,i)=>{try{valid.push(csvObject(r))}catch(e){errors.push("Строка "+(i+2)+": "+(e instanceof Error?e.message:String(e)))}});
  return {valid,errors};
 }
 async function commitCsv(){
  if(!user||isDemo){setAuthOpen(true);return;}
  const {valid,errors}=importPreview();
  setImportErrors(errors);if(!valid.length){notify("Нет корректных записей");return;}
  setSaving(true);let done=0;const failed:string[]=[];
  try{for(const item of valid){try{await insertRow(item.kind,user.id,item.row);done++;}catch(e){failed.push(e instanceof Error?e.message:String(e))}}
   setWorkspace(await loadWorkspace());setImportRows([]);setXmlPreview(null);setImportErrors([...errors,...failed].slice(0,12));notify("Загружено: "+done+"; пропущено: "+(errors.length+failed.length));
  }finally{setSaving(false)}
 }

 const toolbar=(kind:EntityKind,label="Добавить")=><div className="toolbar"><button className="btn line" onClick={exportView}><FileDown size={16}/> Экспорт CSV</button><button className="btn primary" onClick={()=>openForm(kind)}><Plus size={16}/> {label}</button></div>;

 return <div className="app">
  <aside className={"sidebar "+(mobileNav?"mobile-open":"")}>
   <div className="brand" onClick={()=>goto("overview")} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")goto("overview")}}>
    <div className="brand-symbol"><Layers3 size={22}/></div><div><div className="brand-name">NEXUS<span>.</span></div><div className="brand-caption">ANALYTICS INTELLIGENCE</div></div>
   </div>
   <div className="workspace-selector"><div className="workspace-avatar"><ChartNoAxesCombined size={18}/></div><div><small>РАБОЧАЯ СРЕДА</small><b>{isDemo?"Демонстрация":"Личное пространство"}</b></div><ChevronDown size={15}/></div>
   <div className="nav-label">УПРАВЛЕНИЕ</div>
   <nav className="side-menu">{menu.map(({id,name,icon:Icon})=><button key={id} className={"nav-link "+(view===id?"active":"")} onClick={()=>goto(id)}><Icon size={18}/><span>{name}</span>{view===id&&<span className="nav-active-dot"/>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="sidebar-promote"><div className="sidebar-glow"/><Sparkles size={23}/><strong>Evidence-first</strong><p>Данные, которым можно доверять, начинаются с источника.</p><button onClick={()=>goto("sources")}>Реестры и доступы <ArrowRight size={14}/></button></div><div className="sidebar-footer"><ShieldCheck size={15}/> NEXUS v2.0 · STAGING</div></div>
  </aside>
  {mobileNav&&<button className="sidebar-overlay" aria-label="Закрыть меню" onClick={()=>setMobileNav(false)}/>}
  <main className="main-area">
   <header className="topbar">
    <div className="top-left"><button className="icon-btn hamburger" onClick={()=>setMobileNav(true)} aria-label="Открыть меню"><Menu size={23}/></button><span className="breadcrumb">Workspace</span><ChevronRight size={15}/><strong>{pageTitle}</strong></div>
    <div className="top-right"><span className={"environment-badge "+(isDemo?"demo":"cloud")}><span className="pulse-dot"/>{isDemo?"ДЕМО · учебные данные":"SUPABASE · личная база"}</span><button className="icon-btn reload" onClick={()=>void refresh()} disabled={loading} aria-label="Обновить данные"><RefreshCw size={18} className={loading?"spin":""}/></button><button className="avatar" title={signedIn?"Личный аккаунт":"Вход"} onClick={()=>{if(user)void logout();else setAuthOpen(true)}}>{user?<LogOut size={17}/>:<LockKeyhole size={17}/>}</button></div>
   </header>
   <div className="content">
    <div className="workspace-actions"><div className="context-date"><span className="context-dot"/> NEXUS Analytics Platform <span className="slash">/</span> {new Date().toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</div><div className="context-controls">{user&&<button className={"mode-switch "+(!isDemo?"active":"")} onClick={()=>setMode(isDemo?"cloud":"demo")}>{isDemo?"Перейти в личную базу":"Посмотреть ДЕМО"} <ArrowRight size={14}/></button>}{!user&&<button className="mode-switch" onClick={()=>setAuthOpen(true)}>Создать пространство <ArrowUpRight size={14}/></button>}</div></div>
    {(!configured&&!isDemo)&&<div className="inline-alert danger">Supabase не настроен для этого развёртывания. Включите публичные переменные VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.</div>}
    {view==="overview"&&<>
     <section className="hero">
      <div className="hero-art"><div className="orb one"/><div className="orb two"/><div className="hero-gridlines"/></div>
      <div className="hero-text"><span className="eyebrow light"><Sparkles size={13}/> НОВЫЙ СТАНДАРТ БИЗНЕС-АНАЛИТИКИ</span><h1>Видеть больше.<br/><em>Решать точнее.</em></h1><p>Компании, поставщики, рыночные цены, закупки, судебные дела и связи — в единой системе с прозрачным происхождением данных.</p><div className="row wrap"><button className="btn on-dark" onClick={()=>goto("companies")}>Исследовать компании <ArrowRight size={17}/></button><button className="btn hero-outline" onClick={()=>goto("sources")}>Источники данных <ArrowUpRight size={16}/></button></div></div>
      <div className="hero-visual"><div className="visual-card"><div className="v-top"><span className="live-pulse"/> МОДЕЛЬ АНАЛИЗА <span>v2.0</span></div><div className="v-title">Доказательная аналитика</div><MiniColumns values={[35,55,42,70,58,82,68,95]}/><div className="v-line"><div><b>{metrics.companies}</b><span>Компаний</span></div><div><b>{metrics.products}</b><span>Товаров</span></div><div><b>{metrics.signals}</b><span>Сигналов</span></div></div><div className="v-proof"><ShieldCheck size={15}/> Источники и статусы разделены</div></div></div>
     </section>
     <div className="headline-strip"><span>ОБЗОР ПРОСТРАНСТВА</span><span>{isDemo?"Все показатели ниже — вымышленные учебные данные":"Данные только вашего аккаунта Supabase"}</span></div>
     <div className="metric-grid"><Metric label="Организации" value={metrics.companies} sub="Компаний в досье" icon={Building2}/><Metric label="Продукция" value={metrics.products} sub="Позиций в каталоге" icon={Package}/><Metric label="Процедуры" value={isDemo?dataset.procurements.length:metrics.procurements} sub="Участие ≠ победа" icon={BriefcaseBusiness}/><Metric label="Рыночные данные" value={metrics.marketOffers} sub="Предложений с ценой" icon={BarChart3}/></div>
     <div className="home-columns"><section className="panel"><div className="panel-top"><div><span className="eyebrow">INTELLIGENCE</span><h2>Основные направления</h2></div><span className="tiny-count">04 модуля</span></div><div className="quick-grid">{[{name:"Проверка компаний",icon:Building2,view:"companies" as View,copy:"Реквизиты, источники, профили"},{name:"Анализ продукции",icon:Package,view:"products" as View,copy:"Цены, наличие, сравнения"},{name:"История закупок",icon:BriefcaseBusiness,view:"procurements" as View,copy:"Участие, победы, договоры"},{name:"Юридические сигналы",icon:Scale,view:"courts" as View,copy:"Дела, роли, источники"}].map(x=><button className="quick-item" key={x.name} onClick={()=>goto(x.view)}><span className="quick-icon"><x.icon size={18}/></span><strong>{x.name}</strong><small>{x.copy}</small><ArrowUpRight className="quick-arrow" size={15}/></button>)}</div></section><section className="panel status-panel"><div className="panel-top"><div><span className="eyebrow">ПРОИСХОЖДЕНИЕ ДАННЫХ</span><h2>Контроль качества</h2></div><ShieldCheck size={20} className="accent-icon"/></div><div className="quality-ring"><div className="quality-core"><strong>{metrics.companies?Math.round(metrics.linked/metrics.companies*100):0}%</strong><small>со ссылками</small></div></div><p className="quality-caption">Наличие ссылки не означает документального подтверждения.</p><button className="text-link" onClick={()=>goto("sources")}>Реестры и ограничения <ArrowRight size={16}/></button></section></div>
     <ResearchPanel signedIn={signedIn} onSave={saveOfficial}/>
    </>}
    {view==="companies"&&<>
     <SectionTop kicker="ENTITY INTELLIGENCE" title="Компании и контрагенты" subtitle="Единая карточка: юридическая идентификация, товары, закупки, дела и возможные связи." action={toolbar("company","Добавить компанию")}/>
     <div className="inline-alert"><ShieldCheck size={16}/> Совпадение директора или адреса — сигнал для проверки, а не доказательство аффилированности.</div>
     <div className="panel search-panel"><Search size={18}/><input value={companyQuery} onChange={e=>setCompanyQuery(e.target.value)} placeholder="Поиск по названию, ИНН, региону или отрасли"/><span className="item-count">{dataset.companies.length} организаций</span></div>
     <div className="company-layout"><div className="panel company-list"><div className="panel-top"><h2>Каталог</h2><span className="tiny-count">Сведения из вашей базы</span></div>{dataset.companies.filter(c=>[c.name,c.inn,c.region,c.activity].join(" ").toLowerCase().includes(companyQuery.toLowerCase())).length?dataset.companies.filter(c=>[c.name,c.inn,c.region,c.activity].join(" ").toLowerCase().includes(companyQuery.toLowerCase())).map(c=><button key={c.id} className={"company-row "+((selectedCompany||dataset.companies[0]?.id)===c.id?"selected":"")} onClick={()=>setSelectedCompany(c.id)}><span className="company-monogram">{c.name.replace(/[^А-ЯA-Z]/g,"").slice(0,2)||"CO"}</span><span className="company-info"><strong>{c.name}</strong><small>ИНН {c.inn} · {c.region||"Регион не указан"}</small></span><ChevronRight size={17}/></button>):<Empty heading="Компаний пока нет" copy="Добавьте контрагента или сохраните подтверждённый результат поиска по ИНН."/>}</div>
      <div className="panel detail-panel">{(()=>{const c=dataset.companies.find(c=>c.id===(selectedCompany||dataset.companies[0]?.id));if(!c)return <Empty heading="Выберите компанию" copy="Для карточки нужны записи в каталоге."/>;const ctx=companyContext(dataset,c.id);return <><div className="panel-top"><span className="eyebrow">COMPANY PROFILE</span><Evidence status={c.verification_status} source={c.source_url}/></div><h2 className="company-title">{c.name}</h2><div className="detail-meta">{c.activity||"Отрасль не указана"} · {c.region||"Регион не указан"}</div><div className="kv two three"><div><small>ИНН</small><b>{c.inn}</b></div><div><small>ОГРН</small><b>{c.ogrn||"Не указан"}</b></div><div><small>Руководитель</small><b>{c.director||"Не указан"}</b></div><div><small>Адрес</small><b>{c.legal_address||"Не указан"}</b></div></div><div className="detail-tally">{[{label:"Товаров",num:ctx.products.length,view:"products" as View},{label:"Закупок",num:ctx.procurements.length,view:"procurements" as View},{label:"Судебных записей",num:ctx.courts.length,view:"courts" as View}].map(t=><button key={t.label} onClick={()=>goto(t.view)}><strong>{t.num}</strong><span>{t.label}</span><ArrowUpRight size={14}/></button>)}</div><div className="row wrap company-links"><SourceLink url={c.source_url}/>{safeHttpUrl(c.website)&&<a className="btn line" target="_blank" rel="noopener noreferrer" href={c.website||undefined}>Сайт компании <ArrowUpRight size={15}/></a>}</div><div className="detail-end">Обратите внимание: если источник не проверен, информация остаётся непроверенной.</div></>})()}</div></div>
     <ResearchPanel signedIn={signedIn} onSave={saveOfficial}/>
    </>}
    {view==="products"&&<>
     <SectionTop kicker="MARKET INTELLIGENCE" title="Продукция и цены" subtitle="Сравнение реальных загруженных предложений, наличие товара и актуальность рыночных источников." action={toolbar("product","Добавить товар")}/>
     <div className="two-column"><section className="panel"><div className="panel-top"><div><span className="eyebrow">КАТАЛОГ</span><h2>Товарные позиции</h2></div><span className="tiny-count">{dataset.products.length} товаров</span></div>{dataset.products.length?dataset.products.map(p=><button key={p.id} onClick={()=>setSelectedProduct(p.id)} className={"product-row "+((selectedProduct||dataset.products[0]?.id)===p.id?"selected":"")}><span className="product-icon"><Package size={19}/></span><span className="product-info"><strong>{p.name}</strong><small>{companyName(dataset,p.company_id)} · {p.category||"Без категории"}</small></span><span className={"stock-chip "+p.availability}>{({unknown:"Наличие неизвестно",in_stock:"В наличии",on_request:"Под заказ",out_of_stock:"Нет в наличии"})[p.availability]}</span></button>):<Empty heading="Нет товаров" copy="Добавьте товар, чтобы начать сравнивать ценовые предложения."/>}</section><section className="panel"><div className="panel-top"><div><span className="eyebrow">MARKET BENCHMARK</span><h2>Анализ предложения</h2></div><button className="btn small line" onClick={()=>openForm("offer")}><Plus size={15}/> Добавить цену</button></div>{(()=>{const p=dataset.products.find(p=>p.id===(selectedProduct||dataset.products[0]?.id));if(!p)return <Empty heading="Выберите товар" copy="Сравнивайте цены из разных источников."/>;const offers=productOffers(dataset,p);const m=marketStats(offers);return <><h3 className="selection-title">{p.name}</h3><div className="selection-small">Продавец: {companyName(dataset,p.company_id)}</div><div className="kv three">{m?<><div><small>Минимальная цена</small><b>{currency(m.min)}</b></div><div><small>Медиана</small><b>{currency(m.median)}</b></div><div><small>Максимальная цена</small><b>{currency(m.max)}</b></div></>:<div><small>Рыночная цена</small><b>Нет сведений</b></div>}</div>{m?<div className="price-range"><div className="range-head"><span>Диапазон загруженных цен</span><b>{m.count} предложений</b></div><div className="range-track"><div className="range-fill"/></div><p>Предложений «в наличии»: {m.inStock}. Остатки не подтверждены без источника.</p></div>:<div className="inline-alert">Без источников нельзя рассчитать рыночную стоимость.</div>}<div className="offers">{offers.map(o=><div key={o.id} className="offer-row"><div><strong>{o.seller_name}</strong><small>{dateLabel(o.observed_at)} · {o.stock_status==="in_stock"?"В наличии":o.stock_status==="on_request"?"Под заказ":"Наличие не подтверждено"}</small><SourceLink url={o.source_url}/></div><b>{currency(o.unit_price)}</b></div>)}</div></>})()}</section></div>
    </>}
    {view==="procurements"&&<>
     <SectionTop kicker="PROCUREMENT INTELLIGENCE" title="Закупки и договоры" subtitle="Разделяем участие, подтверждение победы и заключение контракта. Никакой подмены понятий." action={toolbar("procurement","Добавить событие")}/>
     <div className="inline-alert gold"><CircleAlert size={17}/> Договор ≠ победа в закупке. Количество событий не является полным реестром ЕИС.</div>
     <div className="metric-grid"><Metric label="Участия" value={proc.participation} sub="Заявленные события" icon={FileSearch}/><Metric label="Победы" value={proc.wins} sub="Требуют сверки" icon={BadgeCheck}/><Metric label="Договоры" value={proc.contracts} sub="В загруженных данных" icon={BriefcaseBusiness}/><Metric label="Сумма договоров" value={currency(proc.contractValue)} sub="Не официальный объём" icon={ChartNoAxesCombined}/></div>
     <div className="panel table-panel"><div className="panel-top"><h2>История событий</h2><div className="row"><SlidersHorizontal size={16}/><select className="filter-select" value={procFilter} onChange={e=>setProcFilter(e.target.value)}><option value="all">Все события</option><option value="participation">Участие</option><option value="win">Победа</option><option value="contract">Договор</option></select></div></div><div className="responsive-table"><table><thead><tr><th>Номер</th><th>Компания</th><th>Заказчик</th><th>Тип</th><th>Сумма</th><th>Источник</th></tr></thead><tbody>{dataset.procurements.filter(p=>procFilter==="all"||p.event_type===procFilter).map(p=><tr key={p.id}><td><b>{p.procedure_number}</b><small>{dateLabel(p.occurred_at)}</small></td><td>{companyName(dataset,p.company_id)}</td><td>{p.customer||"Не указан"}</td><td><span className={"event-tag "+p.event_type}>{({participation:"Участие",win:"Победа",contract:"Договор",other:"Другое"})[p.event_type]}</span></td><td><b>{p.amount==null?"Неизвестна":currency(p.amount)}</b></td><td><SourceLink url={p.source_url}/></td></tr>)}</tbody></table>{!dataset.procurements.length&&<Empty heading="Нет закупочных записей" copy="Добавьте участие, победу или договор через форму или импорт."/>}</div></div>
    </>}
    {view==="courts"&&<>
     <SectionTop kicker="LEGAL INTELLIGENCE" title="Судебная аналитика" subtitle="Дела, роли сторон и заявленные требования с первоисточниками и без автоматических обвинений." action={toolbar("court","Добавить дело")}/>
     <div className="inline-alert gold"><Scale size={17}/> Участие в деле не означает нарушения. Сумма исковых требований не равна установленной задолженности.</div>
     <div className="metric-grid"><Metric label="Судебные записи" value={dataset.courts.length} sub="В вашей выборке" icon={Scale}/><Metric label="В роли истца" value={dataset.courts.filter(c=>c.role==="plaintiff").length} sub="По загруженным делам" icon={BookOpenCheck}/><Metric label="В роли ответчика" value={dataset.courts.filter(c=>c.role==="defendant").length} sub="Не оценка нарушений" icon={FileSearch}/><Metric label="Сумма требований" value={currency(dataset.courts.reduce((s,x)=>s+Number(x.claim_amount||0),0))} sub="Не сумма долга" icon={Activity}/></div>
     <div className="panel table-panel"><div className="panel-top"><h2>Судебные дела</h2><div className="row"><Filter size={16}/><select className="filter-select" value={courtFilter} onChange={e=>setCourtFilter(e.target.value)}><option value="all">Все роли</option><option value="plaintiff">Истец</option><option value="defendant">Ответчик</option><option value="third_party">Третье лицо</option></select></div></div><div className="responsive-table"><table><thead><tr><th>Номер дела</th><th>Компания</th><th>Суд и стадия</th><th>Роль</th><th>Требования</th><th>Источник</th></tr></thead><tbody>{dataset.courts.filter(c=>courtFilter==="all"||c.role===courtFilter).map(c=><tr key={c.id}><td><b>{c.case_number}</b><small>{dateLabel(c.filed_at)}</small></td><td>{companyName(dataset,c.company_id)}</td><td>{c.court_name}<small>{c.stage}</small></td><td><span className={"event-tag "+c.role}>{({plaintiff:"Истец",defendant:"Ответчик",third_party:"Третье лицо",other:"Иная",unknown:"Неизвестна"})[c.role]}</span></td><td>{c.claim_amount==null?"Нет данных":currency(c.claim_amount)}</td><td><SourceLink url={c.source_url}/></td></tr>)}</tbody></table>{!dataset.courts.length&&<Empty heading="Судебных записей нет" copy="Это не подтверждает отсутствие судебных дел у компании. Проверьте КАД."/>}</div></div>
    </>}
    {view==="relations"&&<>
     <SectionTop kicker="AFFILIATION SIGNALS" title="Возможные связи" subtitle="Автоматический анализ общих руководителей, контактов и адресов. Каждое совпадение остаётся гипотезой." action={<button className="btn line" onClick={()=>goto("companies")}>Каталог компаний <ArrowRight size={16}/></button>}/>
     <div className="inline-alert gold"><CircleAlert size={17}/> Совпадение адресов бизнес-центра или руководителей может иметь законные объяснения. NEXUS не делает вывод об аффилированности без доказательств.</div>
     <div className="metric-grid"><Metric label="Проверено компаний" value={dataset.companies.length} sub="Локальная выборка" icon={Building2}/><Metric label="Совпадения полей" value={signalPairs.length} sub="Автоматические сигналы" icon={Network}/><Metric label="Связи из базы" value={dataset.relations.length} sub="Добавленные сведения" icon={Link2}/><Metric label="Подтверждённые связи" value={dataset.relations.filter(r=>r.verification_status==="official_verified"||r.verification_status==="user_verified").length} sub="Проверены отдельно" icon={ShieldCheck}/></div>
     <div className="signal-grid">{signalPairs.length?signalPairs.map((r,i)=><div className="signal-card" key={i}><div className="signal-top"><span className="signal-icon"><Network size={18}/></span><span className="evidence unknown"><CircleAlert size={12}/> Гипотеза</span></div><h3>{r.a.name} <span>↔</span> {r.b.name}</h3><div className="signal-proof"><strong>{({director:"Общий руководитель",legal_address:"Общий адрес",phone:"Совпадающий телефон",email:"Общий email"})[r.field]}</strong><p>{r.evidence}</p></div><small>Для подтверждения нужны юридически значимые документы.</small></div>):<Empty heading="Совпадений не обнаружено" copy="Добавьте контакты, руководителей и адреса в карточки компаний."/>}{dataset.relations.map(r=><div className="signal-card" key={r.id}><div className="signal-top"><span className="signal-icon"><Link2 size={18}/></span><Evidence status={r.verification_status}/></div><h3>{companyName(dataset,r.company_a)} ↔ {companyName(dataset,r.company_b)}</h3><div className="signal-proof">{relationLabel(r)}: {r.signal_value}</div><SourceLink url={r.source_url}/></div>)}</div>
    </>}
    {view==="sources"&&<>
     <IntegrationHealthPanel signedIn={signedIn}/>
     <SectionTop kicker="INTEGRATION GATEWAY" title="Источники и интеграции" subtitle="Честная матрица реальных подключений, ручных реестров и необходимых разрешений. Все источники — через единый шлюз." action={<button className="btn line" onClick={()=>goto("overview")}>Проверить ИНН <ArrowRight size={16}/></button>}/>
     {providerError&&<div className="inline-alert">{providerError}</div>}<div className="integration-head"><div><span>СИСТЕМЫ И РЕЕСТРЫ</span><h2>Статус подключений</h2></div><span className="integration-counter">{(providers.length?providers:fallbackProviders).length} источников</span></div>
     <div className="source-grid">{(providers.length?providers:fallbackProviders).map(p=><article key={p.id} className="source-card"><div className="source-top"><span className="source-brand"><Database size={18}/></span><span className={"source-state "+(p.status==="live_partial"?"live":"manual")}>{p.status==="live_partial"?"Частично подключено":p.status==="credentials_required"?"Требует доступа":p.status==="manual"?"Ручной доступ":"API / лицензия"}</span></div><h3>{p.name}</h3><strong>{p.scope}</strong><p>{p.reason}</p><a href={safeHttpUrl(p.url)||"#"} target="_blank" rel="noopener noreferrer">Открыть реестр <ArrowUpRight size={16}/></a></article>)}</div>
     <div className="inline-alert gold"><Globe2 size={18}/> Плагины, доступные в ChatGPT, не передают автоматически свои токены приложению. Для каждой внешней базы нужны законный API, серверный адаптер, права и журнал запросов.</div>
    </>}
    {view==="imports"&&<>
     <SectionTop kicker="DATA OPERATIONS" title="Импорт данных" subtitle="Загружайте CSV и XML ФНС/ЕИС: сначала предварительный просмотр, затем сохранение с отметкой источника." action={<button className="btn line" onClick={()=>goto("sources")}>Источники <ArrowRight size={16}/></button>}/>
     <div className="two-column"><section className="panel upload-panel"><div className="panel-top"><h2>Новый импорт</h2><span className="evidence unknown">Проверка перед записью</span></div><label className="field"><span>Сущность</span><select value={importKind} onChange={e=>{setImportKind(e.target.value as EntityKind);setImportRows([]);setXmlPreview(null);setImportErrors([])}}>{Object.entries(kindLabels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className="file-drop"><FileUp size={29}/><strong>Выбрать CSV или XML через «Файлы»</strong><small>CSV UTF-8 · XML ФНС и контракты 44/223 · до 1,5 МБ</small><input type="file" accept=".csv,.xml,text/csv,application/xml,text/xml" onChange={e=>void fileChosen(e.target.files?.[0]||null)}/></label><div className="upload-explain"><b>Поддерживаемые колонки</b><p>{importKind==="company"?"ИНН;Название;Регион;Отрасль;Руководитель;Адрес;Источник":importKind==="product"?"ИНН;Товар;Категория;Единица;Источник":importKind==="procurement"?"ИНН;Номер;Заказчик;Событие;Сумма;Источник":importKind==="court"?"ИНН;Номер дела;Суд;Статус;Источник":"Товар;Продавец;Цена;Источник"}</p></div><p className="import-description">XML распознаётся в браузере. Подписи и подлинность выписок не проверяются. Для контракта сначала добавьте компанию поставщика с тем же ИНН.</p></section><section className="panel upload-panel"><div className="panel-top"><h2>Предварительная проверка</h2><span className="tiny-count">{importFilename||"Файл не выбран"}</span></div>{(importRows.length||xmlPreview)?(()=>{const res=importPreview();return <><div className="kv two"><div><small>Всего строк</small><b>{xmlPreview?.total??importRows.length}</b></div><div><small>Готово к импорту</small><b>{res.valid.length}</b></div></div>{[...importErrors,...res.errors].slice(0,6).map((x,i)=><div className="import-error" key={i}>{x}</div>)}<p className="import-description">Все импортируемые записи получат статус «Не проверено». Совпадения компаний проверяются по ИНН.</p><button className="btn primary full" disabled={saving||!res.valid.length} onClick={()=>void commitCsv()}>{saving?"Добавляем…":"Добавить "+res.valid.length+" записей в Supabase"}</button></>})():<Empty heading="Загрузите файл" copy="Здесь появятся ошибки валидации и количество подходящих строк."/>}{importErrors.map((x,i)=><div key={i} className="import-error">{x}</div>)}</section></div>
    </>}
    <footer className="content-footer"><span>NEXUS ANALYTICS <b>2.0</b> · STAGING</span><span><ShieldCheck size={14}/> Проверка источников обязательна · {configured?"Supabase подключён":"Supabase не настроен"}</span></footer>
   </div>
  </main>
  <nav className="mobile-bottom" aria-label="Мобильная навигация">{menu.filter(x=>["overview","companies","products","procurements"].includes(x.id)).map(({id,name,icon:Icon})=><button key={id} className={view===id?"active":""} onClick={()=>goto(id)}><Icon size={20}/><small>{name}</small></button>)}<button className={["courts","relations","sources","imports"].includes(view)?"active":""} onClick={()=>setMobileNav(true)}><Menu size={20}/><small>Ещё</small></button></nav>
  {toast&&<div className="toast" role="status"><Bell size={17}/>{toast}<button aria-label="Скрыть" onClick={()=>setToast("")}><X size={15}/></button></div>}
  {form&&<EntityForm kind={form} workspace={dataset} onSave={saveForm} onClose={()=>setForm(null)}/>}
  {authOpen&&<div className="modal-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setAuthOpen(false)}}><section className="auth-dialog" role="dialog" aria-modal="true"><div className="dialog-top"><div><span className="eyebrow">NEXUS SECURE WORKSPACE</span><h2>{authMode==="signin"?"Войти в аккаунт":"Создать пространство"}</h2></div><button className="icon-btn" onClick={()=>setAuthOpen(false)} aria-label="Закрыть"><X size={20}/></button></div><p>Личный каталог компаний и аналитические записи защищены политиками Supabase RLS.</p><form onSubmit={e=>{e.preventDefault();void handleAuth()}}><label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label className="field"><span>Пароль</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} autoComplete={authMode==="signin"?"current-password":"new-password"}/></label>{authError&&<div className="inline-alert danger">{authError}</div>}<button className="btn primary full" disabled={!configured||saving}>{saving?"Проверяем…":authMode==="signin"?"Войти в Supabase":"Зарегистрироваться"}</button></form><button className="auth-switch" onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthError("")}}>{authMode==="signin"?"Нет аккаунта? Создать новый":"Есть аккаунт? Войти"}</button><div className="auth-foot"><LockKeyhole size={15}/> Клиент использует только публичный ключ. Серверные секреты здесь не хранятся.</div></section></div>}
 </div>;
}
