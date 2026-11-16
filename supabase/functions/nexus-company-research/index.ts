import "jsr:@supabase/functions-js/edge-runtime.d.ts";
type Link={title:string,url:string,description:string,published?:string,source_type:"search_result",verified:false};
type Group={status:"searched"|"unavailable",count:number,results:Link[],query:string,error?:string};
const PROJECT_URL=Deno.env.get("SUPABASE_URL")||"https://mjqicmrwstqypwnvtkyf.supabase.co";
const PUB_KEY=Deno.env.get("SUPABASE_ANON_KEY")||"";
const allowedOrigins=new Set(["https://nexus-analytics-hub-volgamen163-1027.vercel.app","https://nexus-analytics-hub.vercel.app","https://nexus-analytics-v2-staging.vercel.app"]);
const targetCodes:Record<string,{ogrn:string,url:string,name:string,address:string,region:string,site:string}>={"7707083893":{ogrn:"1027700132195",url:"https://www.cbr.ru/finorg/foinfo/?ogrn=1027700132195",name:"ПАО Сбербанк",address:"117312, Москва, ул. Вавилова, д. 19",region:"Москва",site:"https://www.sberbank.ru/"},"7702070139":{ogrn:"1027739609391",url:"https://www.cbr.ru/finorg/foinfo/?ogrn=1027739609391",name:"Банк ВТБ (ПАО)",address:"191144, Санкт-Петербург, Дегтярный переулок, д. 11 лит. А",region:"Санкт-Петербург",site:"https://www.vtb.ru/"},"7728168971":{ogrn:"1027700067328",url:"https://www.cbr.ru/finorg/foinfo/?ogrn=1027700067328",name:"АО \"АЛЬФА-БАНК\"",address:"107078, Москва, ул. Каланчевская, д. 27",region:"Москва",site:"https://alfabank.ru/"}};
function cors(req:Request){const o=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":allowedOrigins.has(o)?o:"https://nexus-analytics-hub-volgamen163-1027.vercel.app","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET,OPTIONS","Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}}
function send(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:cors(req)})}
function dec(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-fA-F]+|\d+);/g,x=>{const dic:Record<string,string>={"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" "};if(dic[x])return dic[x];try{const v=x.startsWith("&#x")?parseInt(x.slice(3),16):parseInt(x.slice(2),10);return v>=32&&v<=0x10FFFF?String.fromCodePoint(v):" ";}catch{return x}})}
function norm(s:string){return dec(s.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim()}
function xmlTag(s:string,t:string){const m=s.match(new RegExp("<"+t+"(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/"+t+">","i"));return m?norm(m[1]):""}
function safeLink(s:string){try{const u=new URL(s);return u.protocol==="https:"||u.protocol==="http:"?u.href:null}catch{return null}}
function rss(xml:string):Link[]{const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,7);return items.map(m=>{const raw=m[1];const url=safeLink(xmlTag(raw,"link"));if(!url)return null;return {title:xmlTag(raw,"title").slice(0,180),url,description:xmlTag(raw,"description").slice(0,500),published:xmlTag(raw,"pubDate").slice(0,80),source_type:"search_result" as const,verified:false}}).filter((v):v is Link=>!!v)}
async function fetchText(url:string,timeout=7200){const r=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{"Accept":"text/html, application/xml, text/xml;q=0.9,*/*;q=0.5","User-Agent":"Mozilla/5.0 (compatible; NEXUS-Analytics-Hub/0.4; company research)"}});
if(!r.ok)throw Error("Источник вернул "+r.status);const txt=await r.text();return txt.slice(0,180000)}
async function search(query:string,inn:string):Promise<Group>{const endpoint="https://www.bing.com/search?format=rss&q="+encodeURIComponent(query);
try{const text=await fetchText(endpoint);const name=inn==="7707083893"?"сбербанк":"";const found=rss(text).filter(x=>{const evidence=(x.title+" "+x.description+" "+x.url).toLowerCase();return evidence.includes(inn)||(name&&evidence.includes(name));});return {status:"searched",count:found.length,results:found,query};}catch(e){return {status:"unavailable",count:0,results:[],query,error:String(e).slice(0,120)}}}
async function verifyJwt(req:Request){const auth=req.headers.get("authorization")||"";const match=auth.match(/^Bearer\s+(.+)$/i);if(!match||!match[1]||match[1].startsWith("sb_publishable_"))return null;
try{const p=await fetch(PROJECT_URL+"/auth/v1/user",{headers:{"apikey":PUB_KEY,"Authorization":"Bearer "+match[1]},signal:AbortSignal.timeout(4800)});
if(!p.ok)return null;const u=await p.json();if(!u.id)return null;return {id:String(u.id)};}catch{return null}}
function innValid(inn:string){if(!/^(?:\d{10}|\d{12})$/.test(inn))return false;const n=[...inn].map(Number);const checksum=(weights:number[])=>weights.reduce((sum,w,i)=>sum+w*n[i],0)%11%10;return inn.length===10?checksum([2,4,10,3,5,9,4,6,8])===n[9]:checksum([7,2,4,10,3,5,9,4,6,8])===n[10]&&checksum([3,7,2,4,10,3,5,9,4,6,8])===n[11];}
const providers=[
{id:"fns",name:"ФНС · Прозрачный бизнес",status:"manual",scope:"Регистрация, руководство, учредители, ОКВЭД",reason:"Официальный доступ к массовой интеграции ЕГРЮЛ требует отдельного оформления; данные не импортируются автоматически.",url:"https://pb.nalog.ru/"},
{id:"egrul",name:"ФНС · ЕГРЮЛ",status:"manual",scope:"Выписка и регистрационные сведения",reason:"Официальный поиск по отдельной компании доступен на сайте. Для массовых информационных систем предусмотрены отдельные условия.",url:"https://egrul.nalog.gov.ru/"},
{id:"fns_opendata",name:"ФНС · Открытые наборы",status:"manual",scope:"Публичные наборы данных ФНС",reason:"Официальные открытые наборы доступны для загрузки. Это не онлайн-API полного ЕГРЮЛ и не проверка конкретного ИНН.",url:"https://www.nalog.gov.ru/opendata/"},
{id:"cbr",name:"Банк России",status:"live_partial",scope:"Банки и другие финансовые организации",reason:"Автоматическое подтверждение доступно для 3 тестовых банков; для других компаний необходим ОГРН и отдельная проверка.",url:"https://www.cbr.ru/finorg/"},
{id:"eis",name:"ЕИС · 44-ФЗ / 223-ФЗ",status:"credentials_required",scope:"Закупки, участники, договоры, результаты",reason:"Для структурированной интеграции нужны соответствующие права и доступ к интеграционным сервисам ЕИС.",url:"https://zakupki.gov.ru/"},
{id:"kad",name:"КАД Арбитр",status:"licensed_or_manual",scope:"Арбитражные дела и судебные акты",reason:"Бесплатный официальный массовый API не подтверждён. Дела можно проверять на сайте; коммерческие API требуют договора.",url:"https://kad.arbitr.ru/"},
{id:"fedresurs",name:"Федресурс",status:"manual",scope:"Юридически значимые сообщения и банкротства",reason:"Проверка доступна на сайте; отдельный API для этого приложения ещё не подключён.",url:"https://fedresurs.ru/"},
{id:"fssp",name:"ФССП",status:"manual",scope:"Исполнительные производства",reason:"Реестр доступен через официальный сайт; автоматический интеграционный доступ не подтверждён.",url:"https://fssp.gov.ru/iss/ip/"},
{id:"gisp",name:"ГИСП",status:"manual",scope:"Промышленные товары, производители, ОКПД2",reason:"Поиск продукции доступен на сайте. API-ключ и условия для автоматического каталога не подключены.",url:"https://gisp.gov.ru/"},
{id:"torgi",name:"ГИС Торги",status:"manual",scope:"Государственные и муниципальные торги",reason:"Официальный поиск доступен в браузере; автоматическое API-подключение не настроено.",url:"https://torgi.gov.ru/"}
];
const SAMPLE="7707083893";
Deno.serve(async(req:Request)=>{
if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
if(req.method!=="GET")return send(req,{error:"Method not allowed"},405);
const u=new URL(req.url),mode=u.searchParams.get("mode")||"lookup",inn=(u.searchParams.get("inn")||"").trim(),ogrn=(u.searchParams.get("ogrn")||"").trim();
if(mode==="health")return send(req,{ok:true,version:"0.6.0",capabilities:["verified financial organization cards","optional INN + OGRN crosscheck for financial institutions","source status registry","authenticated INN discovery","source links"],requiresLoginForArbitraryInn:true});
if(mode==="providers")return send(req,{ok:true,updatedAt:new Date().toISOString(),providers});
if(!innValid(inn))return send(req,{error:"Проверьте ИНН: требуется 10 или 12 цифр с правильной контрольной суммой"},400);
if(ogrn&&!/^\d{13}$/.test(ogrn))return send(req,{error:"ОГРН должен содержать 13 цифр"},400);
if(ogrn&&targetCodes[inn]&&ogrn!==targetCodes[inn].ogrn)return send(req,{error:"ИНН и ОГРН относятся к разным организациям согласно проверенному справочнику"},400);
if(mode!=="demo"&&mode!=="lookup")return send(req,{error:"Unknown mode"},400);
const isPublicDemo=mode==="demo"&&(inn in targetCodes||(inn==="7744001497"&&ogrn==="1027700167110"));
if(!isPublicDemo&&!(await verifyJwt(req)))return send(req,{error:"Для проверки произвольного ИНН войдите в облачный аккаунт NEXUS."},401);
const at=new Date().toISOString();
const queries={profile:'"'+inn+'" организация компания официальный сайт',tenders:'"'+inn+'" закупки договоры победитель',courts:'"'+inn+'" арбитражный суд дела',products:'"'+inn+'" продукция товары услуги каталог'};
const keys=Object.keys(queries) as Array<keyof typeof queries>;
const resolved=await Promise.all(keys.map(k=>search(queries[k],inn)));
const groups:Record<string,Group>={};keys.forEach((k,i)=>groups[k]=resolved[i]);
let official=null as null|{name:string,inn:string,ogrn:string,address:string,status:string,verified:true,sourceUrl:string,source:"Банк России",retrievedAt:string,region:string,site:string};
let officialStatus="not_supported";
if(targetCodes[inn]){
try{const base=targetCodes[inn];const html=await fetchText(base.url,6500);const text=norm(html);
if(text.includes(inn)&&text.includes(base.ogrn)&&text.includes(base.name)){
official={name:base.name,inn,ogrn:base.ogrn,address:base.address,region:base.region,site:base.site,status:text.includes("Действует")?"Действует":"Не установлен",verified:true,sourceUrl:base.url,source:"Банк России",retrievedAt:at};officialStatus="verified";}else officialStatus="mismatch";
}catch{officialStatus="unavailable"}
}
if(!official&&ogrn&&!targetCodes[inn]){
  const url="https://www.cbr.ru/finorg/foinfo/?ogrn="+ogrn;
  try{
    const html=await fetchText(url,6000);
    const pageName=xmlTag(html,"title").replace(/\s*\|\s*Банк России.*$/i,"").trim();
    const text=norm(html);
    if(pageName&&pageName!=="Банк России"&&text.includes(inn)&&text.includes(ogrn)){
      official={name:pageName,inn,ogrn,address:"Уточните по официальной карточке",status:/Статус УФР\s+Действует/i.test(text)?"Действует":"Не установлен",verified:true,sourceUrl:url,source:"Банк России",retrievedAt:at,region:"Уточняется",site:""};
      officialStatus="verified";
    }else{officialStatus="mismatch";}
  }catch{officialStatus="unavailable";}
}
return send(req,{ok:true,mode:isPublicDemo?"demo":"lookup",inn,checkedAt:at,official,officialStatus,
groups,stats:{discoveredResults:resolved.reduce((x,y)=>x+y.count,0),categoriesSearched:keys.length,officialVerified:!!official},
references:{egrul:"https://egrul.nalog.gov.ru/",fns:"https://pb.nalog.ru/",cbr:"https://www.cbr.ru/finorg/",eis:"https://zakupki.gov.ru/",cad:"https://kad.arbitr.ru/",gisp:"https://gisp.gov.ru/",fssp:"https://fssp.gov.ru/iss/ip/"},
providers:providers.map(x=>({id:x.id,name:x.name,status:x.status,url:x.url,reason:x.reason})),
notes:["Поиск ссылок через общедоступный индекс не подтверждает участие в закупке, выигрыш тендера или наличие судебного дела.","Отсутствие результатов в поиске не означает отсутствие сведений в реестрах.","Подтверждённая карточка Банка России пока реализована для трёх проверенных банков (Сбербанк, ВТБ и Альфа-Банк); остальные ИНН получают поисковые совпадения и ссылки для ручной проверки.","Каталог товаров и складские остатки не определяются поиском по ИНН автоматически."]});
});