import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, FileDown, FileSearch, Globe2, Network, Package, Printer, Scale, Search, ShieldCheck } from "lucide-react";
import type { Company, View, Workspace } from "../lib/types";
import { buildDossier, dossierCsv } from "../lib/dossier";
import { currency, dateLabel, downloadCsv, safeHttpUrl } from "../lib/validation";

const evidence: Record<string,string>={unverified:"Не проверено",source_linked:"Есть ссылка",user_verified:"Сверено пользователем",official_verified:"Подтверждено реестром"};
const availability:Record<string,string>={in_stock:"Заявлено наличие",on_request:"Под заказ",out_of_stock:"Заявлено отсутствие",unknown:"Наличие не установлено"};
function Source({url}:{url?:string|null}){const safe=safeHttpUrl(url);return safe?<a className="dossier-link" target="_blank" rel="noopener noreferrer" href={safe}>Источник <ArrowUpRight size={13}/></a>:<span className="dossier-muted">Нет ссылки</span>}
export function CompanyDossier({data,company,isDemo,onSelect,onPage,onBack}:{
 data:Workspace;company?:Company;isDemo:boolean;onSelect:(c:Company)=>void;onPage:(view:View)=>void;onBack:()=>void
}){
 const [q,setQ]=useState("");const [missing,setMissing]=useState(false);
 const d=company?buildDossier(data,company.id,isDemo):null;
 function find(){
  const x=q.trim().toLocaleLowerCase("ru");if(!x)return;
  const found=data.companies.find(c=>c.inn===x)||data.companies.find(c=>c.name.toLocaleLowerCase("ru").includes(x));
  if(found){onSelect(found);setMissing(false)}else setMissing(true);
 }
 function exportReport(){if(d)downloadCsv("nexus-dossier-"+d.company.inn.replace(/[^0-9a-z]/gi,"")+".csv",dossierCsv(d))}
 const cards=d?[["Товары",d.products.length,Package,"products"],["Участия",d.participation,FileSearch,"procurements"],["Заявленные победы",d.wins,BadgeCheck,"procurements"],["Договоры",d.contracts,BriefcaseBusiness,"procurements"],["Судебные записи",d.courts.length,Scale,"courts"],["Сигналы связей",d.relations.length,Network,"relations"]] as const:[];
 return <div className="dossier-screen">
   <header className="dossier-title"><div><span className="eyebrow">NEXUS 2.2 · COMPANY INTELLIGENCE</span><h1>Единое досье компании</h1><p>ИНН → компания → продукция → закупки → суды → отчёт.</p></div><button className="btn line" onClick={onBack}><ArrowLeft size={16}/> К каталогу</button></header>
   <section className="panel dossier-search"><div className="dossier-search-line"><Search size={18}/><input aria-label="Поиск компании по ИНН или названию" placeholder="ИНН или название в вашем каталоге" value={q} onChange={e=>{setQ(e.target.value);setMissing(false)}} onKeyDown={e=>{if(e.key==="Enter")find()}}/><button className="btn primary" onClick={find}>Найти</button></div>
    <div className="dossier-picker"><span>{isDemo?"Учебная база":"Личная база"}:</span><select aria-label="Компания для досье" value={company?.id||""} onChange={e=>{const match=data.companies.find(c=>c.id===e.target.value);if(match)onSelect(match)}}><option value="">Выбрать компанию</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name} · {c.inn}</option>)}</select></div>
    {missing&&<div className="dossier-warn">В вашем каталоге организация не найдена. Это не означает, что её нет в ЕГРЮЛ. <button className="btn line" onClick={()=>onPage("overview")}>Проверить ИНН <ArrowRight size={14}/></button></div>}
   </section>
   {!d?<section className="panel dossier-empty"><Search size={32}/><h2>Досье ещё не сформировано</h2><p>Сначала выберите сохранённую компанию или найдите организацию по ИНН.</p><button className="btn primary" onClick={()=>onPage("overview")}>Автопоиск ИНН</button></section>:<>
    <section className="panel dossier-company"><div className="dossier-title"><div><span className="eyebrow">{isDemo?"УЧЕБНЫЕ ВЫМЫШЛЕННЫЕ ДАННЫЕ":"СВЕДЕНИЯ ВАШЕЙ БАЗЫ"}</span><h2>{d.company.name}</h2><p>{d.company.activity||"Отрасль неизвестна"} · {d.company.region||"Регион неизвестен"}</p></div><span className={"dossier-badge "+(d.company.verification_status==="official_verified"?"good":"unknown")}>{evidence[d.company.verification_status||"unverified"]}</span></div>
     <div className="dossier-facts"><div><small>ИНН</small><b>{d.company.inn}</b></div><div><small>ОГРН</small><b>{d.company.ogrn||"Не указан"}</b></div><div><small>Руководитель</small><b>{d.company.director||"Не указан"}</b></div><div><small>Адрес</small><b>{d.company.legal_address||"Не указан"}</b></div></div>
     <div className="dossier-actions"><Source url={d.company.source_url}/>{safeHttpUrl(d.company.website)&&<a className="dossier-link" href={safeHttpUrl(d.company.website)!} target="_blank" rel="noopener noreferrer"><Globe2 size={14}/> Сайт компании</a>}<button className="btn primary" onClick={exportReport}><FileDown size={15}/> Отчёт CSV</button><button className="btn line" onClick={()=>window.print()}><Printer size={15}/> PDF / печать</button></div>
    </section>
    <section className="dossier-metrics">{cards.map(([label,n,Icon,page])=><button className="panel dossier-stat" key={label} onClick={()=>onPage(page)}><span>{label}<Icon size={17}/></span><b>{n}</b><small>Открыть раздел <ArrowUpRight size={13}/></small></button>)}</section>
    <section className="panel dossier-section"><div className="dossier-section-head"><div><span className="eyebrow">01 · MARKET INTELLIGENCE</span><h2>Продукция и рыночные цены</h2></div><button className="btn line" onClick={()=>onPage("products")}>Анализ рынка <ArrowRight size={15}/></button></div>
     {d.products.length?d.products.map(({product,offers,medianRub})=><div className="dossier-row" key={product.id}><div><strong>{product.name}</strong><p>{product.category} · {product.unit} · {availability[product.availability]}{product.stock_qty==null?"":" · заявленный остаток "+product.stock_qty}</p><Source url={product.source_url}/></div><div className="dossier-right"><b>{medianRub===null?"Цена не определена":currency(medianRub)}</b><small>{offers.length} предложений из базы · медиана RUB</small><small>Остатки не проверены онлайн</small></div></div>):<p className="dossier-muted">Товары пока не загружены. Это не доказывает, что компания не производит продукцию.</p>}
    </section>
    <section className="panel dossier-section"><div className="dossier-section-head"><div><span className="eyebrow">02 · PROCUREMENT INTELLIGENCE</span><h2>Участие, победы и договоры</h2></div><button className="btn line" onClick={()=>onPage("procurements")}>Все закупки <ArrowRight size={15}/></button></div><p className="dossier-summary">Сумма записей договоров: <b>{currency(d.contractValue)}</b> · без вывода о победе</p>
     {d.procurements.length?d.procurements.map(x=><div className="dossier-row" key={x.id}><div><strong>{x.procedure_number} · {x.customer}</strong><p>{x.event_type==="win"?"Заявлена победа":x.event_type==="contract"?"Договор":x.event_type==="participation"?"Участие":"Тип не определён"} · {x.law} · {dateLabel(x.occurred_at)}</p><Source url={x.source_url}/></div><div className="dossier-right"><b>{x.amount==null?"Сумма неизвестна":currency(Number(x.amount))}</b><small>{evidence[x.verification_status||"unverified"]}</small></div></div>):<p className="dossier-muted">Закупочных событий в базе нет. Полная история ЕИС пока недоступна.</p>}
    </section>
    <section className="panel dossier-section"><div className="dossier-section-head"><div><span className="eyebrow">03 · COURT INTELLIGENCE</span><h2>Судебные разбирательства</h2></div><button className="btn line" onClick={()=>onPage("courts")}>Все дела <ArrowRight size={15}/></button></div>
     {d.courts.length?d.courts.map(x=><div className="dossier-row" key={x.id}><div><strong>{x.case_number} · {x.court_name}</strong><p>{x.role} · {x.stage} · {dateLabel(x.filed_at)}</p><Source url={x.source_url}/></div><div className="dossier-right"><b>{x.claim_amount==null?"Требования не указаны":currency(Number(x.claim_amount))}</b><small>Исковые требования ≠ установленный долг</small></div></div>):<p className="dossier-muted">Судебных записей в базе нет. Это не подтверждает отсутствие дел.</p>}
    </section>
    <section className="panel dossier-section"><div className="dossier-section-head"><div><span className="eyebrow">04 · RELATIONS</span><h2>Связи и проверка источников</h2></div><button className="btn line" onClick={()=>onPage("relations")}>Все связи <ArrowRight size={15}/></button></div>
     {d.relations.length?d.relations.map(x=><div className="dossier-row" key={x.id}><div><strong>Сигнал: {x.signal_type}</strong><p>{x.signal_value} · возможная связь, не подтверждённая аффилированность</p><Source url={x.source_url}/></div></div>):<p className="dossier-muted">Сохранённых связей нет. Автоматические совпадения смотри в разделе «Связи компаний».</p>}
    </section>
    <section className="dossier-caveat"><ShieldCheck size={21}/><div><strong>Ограничения анализа</strong><p>{d.recordCount} записей в текущей выборке · {d.sourceCount} со ссылками. Это не полное досье ЕИС, ФНС или КАД. Ссылка сама по себе не подтверждает документ. Судебное дело не доказывает нарушение; договор не равен победе.{isDemo?" Все данные учебные и вымышленные.":""}</p></div></section>
    <div className="dossier-actions"><button className="btn primary" onClick={()=>onPage("imports")}>Добавить сведения <ArrowRight size={16}/></button><button className="btn line" onClick={exportReport}><FileDown size={16}/> Скачать отчёт</button></div>
   </>}
 </div>;
}
