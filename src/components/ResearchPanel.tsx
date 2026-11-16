import { useState } from "react";
import { ArrowUpRight, CheckCircle2, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { researchEndpoint, supabase } from "../lib/supabase";
import { safeHttpUrl, validInn } from "../lib/validation";

export type OfficialCompany = {
  name: string; inn: string; ogrn: string; address: string; region?: string;
  site?: string; status: string; verified: boolean; sourceUrl: string; retrievedAt: string
};
type ResearchResult = {
  ok?: boolean; inn?: string; error?: string; official?: OfficialCompany | null;
  officialStatus?: string; stats?: {discoveredResults?:number};
  groups?: Record<string,{count:number;status:string;results?:{title:string;url:string}[]}>;
};
const pilot:Record<string,string>={ "7707083893":"", "7702070139":"", "7728168971":"", "7744001497":"1027700167110" };

export function ResearchPanel({signedIn,onSave}:{signedIn:boolean;onSave:(company:OfficialCompany)=>Promise<void>}) {
 const [inn,setInn]=useState("7707083893");
 const [ogrn,setOgrn]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<ResearchResult|null>(null);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 async function lookup(){
  setError("");setResult(null);
  if(!validInn(inn)){setError("Укажите ИНН с корректной контрольной суммой (10 или 12 цифр)");return;}
  if(ogrn&&!/^\d{13}$/.test(ogrn)){setError("ОГРН должен содержать 13 цифр");return;}
  const demo=Object.prototype.hasOwnProperty.call(pilot,inn)&&pilot[inn]===ogrn;
  if(!demo&&!signedIn){setError("Для произвольного ИНН войдите в тестовый аккаунт. Бесплатные примеры доступны без регистрации.");return;}
  if(!researchEndpoint.startsWith("https://")){setError("Сервер исследования не настроен");return;}
  setBusy(true);
  try{
   const token=!demo?(await supabase?.auth.getSession()).data.session?.access_token:null;
   if(!demo&&!token)throw new Error("Сессия Supabase не найдена");
   const url=new URL(researchEndpoint);url.searchParams.set("inn",inn);url.searchParams.set("mode",demo?"demo":"lookup");
   if(ogrn)url.searchParams.set("ogrn",ogrn);
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),17000);
   try{
    const response=await fetch(url.toString(),{headers:token?{Authorization:"Bearer "+token}:undefined,signal:controller.signal,cache:"no-store"});
    const body:ResearchResult=await response.json();
    if(!response.ok||!body.ok)throw new Error(body.error||"Ошибка исследования ("+response.status+")");
    setResult(body);
   } finally {clearTimeout(timeout);}
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }
 async function save(){
  if(!result?.official?.verified)return;
  setSaving(true);try{await onSave(result.official);setError("");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSaving(false);}
 }
 return <section className="research-block" aria-label="Поиск компании по ИНН">
  <div className="research-copy"><span className="eyebrow">NEXUS RESEARCH / LIVE</span><h2>Проверить организацию</h2><p>Фактический поиск по ИНН. Подтверждённые карточки финансовых организаций — из Банка России. Закупки и суды не объявляем подтверждёнными по одним поисковым ссылкам.</p></div>
  <div className="research-form">
   <label>ИНН<input inputMode="numeric" maxLength={12} value={inn} onChange={e=>setInn(e.target.value.replace(/\D/g,""))} placeholder="10 или 12 цифр" /></label>
   <label>ОГРН <span className="muted">(при наличии)</span><input inputMode="numeric" maxLength={13} value={ogrn} onChange={e=>setOgrn(e.target.value.replace(/\D/g,""))} placeholder="Необязательно" /></label>
   <button className="btn primary" disabled={busy} onClick={()=>void lookup()}>{busy?<LoaderCircle size={16} className="spin"/>:<Search size={17}/>} Проверить</button>
  </div>
  <div className="pilots"><span>Примеры:</span>{[["Сбербанк","7707083893",""],["ВТБ","7702070139",""],["Альфа-Банк","7728168971",""],["Газпромбанк","7744001497","1027700167110"]].map(p=><button key={p[1]} onClick={()=>{setInn(p[1]);setOgrn(p[2]);setResult(null);setError("");}}>{p[0]}</button>)}</div>
  {error&&<div role="alert" className="inline-alert danger">{error}</div>}
  {result&&<div className="result-panel">
   {result.official?.verified?<><div className="result-status"><ShieldCheck size={18}/> Подтверждённая карточка Банка России</div><h3>{result.official.name}</h3><div className="kv two"><div><small>ИНН</small><b>{result.official.inn}</b></div><div><small>ОГРН</small><b>{result.official.ogrn}</b></div><div><small>Статус</small><b>{result.official.status}</b></div><div><small>Регион</small><b>{result.official.region||"Уточняется"}</b></div></div><div className="row wrap">{safeHttpUrl(result.official.sourceUrl)&&<a className="btn line" href={result.official.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть первоисточник <ArrowUpRight size={15}/></a>}{signedIn&&<button className="btn primary" disabled={saving} onClick={()=>void save()}><CheckCircle2 size={16}/> Сохранить в моё досье</button>}</div></>
   :<div className="inline-alert">Подтверждённая карточка не найдена в подключённом официальном источнике. Это не доказывает отсутствие компании в ФНС.</div>}
   <div className="research-meta">Поисковые публикации: {result.stats?.discoveredResults||0}. Такие ссылки требуют самостоятельной проверки и не создают записи о победах или судебных делах.</div>
  </div>}
 </section>;
}
