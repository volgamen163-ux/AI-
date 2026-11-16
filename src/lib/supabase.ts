import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BankCard, Provider, SearchResponse, Workspace } from "../types";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mjqicmrwstqypwnvtkyf.supabase.co";
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const RESEARCH_API = import.meta.env.VITE_RESEARCH_API || SUPABASE_URL + "/functions/v1/nexus-company-research";
export const cloud: SupabaseClient | null = PUBLIC_KEY ? createClient(SUPABASE_URL, PUBLIC_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
function requireCloud(): SupabaseClient {
  if (!cloud) throw new Error("Публичный ключ Supabase не настроен в тестовой сборке.");
  return cloud;
}
export async function fetchWorkspace(): Promise<Workspace> {
  const sb = requireCloud();
  const tables = ["na2_companies","na2_products","na2_procurements","na2_court_cases","na2_market_offers","na2_company_relations"];
  const records = await Promise.all(tables.map(t => sb.from(t).select("*").order("created_at", { ascending: false }).limit(1000)));
  const issue = records.find(x => x.error);
  if (issue?.error) throw issue.error;
  return {
    companies: (records[0].data ?? []) as unknown as Workspace["companies"],
    products: (records[1].data ?? []) as unknown as Workspace["products"],
    tenders: (records[2].data ?? []) as unknown as Workspace["tenders"],
    cases: (records[3].data ?? []) as unknown as Workspace["cases"],
    offers: (records[4].data ?? []) as unknown as Workspace["offers"],
    relations: (records[5].data ?? []) as unknown as Workspace["relations"],
  };
}
export async function saveRecord(table: string, data: Record<string, unknown>, userId: string): Promise<void> {
  const sb = requireCloud();
  if (!userId) throw new Error("Требуется вход");
  const row = { ...data, user_id: userId };
  const { error } = row.id
    ? await sb.from(table).update(row).eq("id",String(row.id)).eq("user_id",userId)
    : await sb.from(table).insert(row);
  if (error) throw error;
}
export async function deleteRecord(table:string,id:string,userId:string):Promise<void>{
  const { error }=await requireCloud().from(table).delete().eq("id",id).eq("user_id",userId);
  if(error) throw error;
}
export async function getProviders():Promise<Provider[]>{
  const response=await fetch(RESEARCH_API+"?mode=providers",{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Реестр интеграций HTTP "+response.status);
  const p=await response.json() as {ok?:boolean,providers?:Provider[]};
  if(!p.ok||!Array.isArray(p.providers))throw new Error("Ответ сервера интеграций некорректен");
  return p.providers;
}
export async function lookupCompany(inn:string,ogrn:string):Promise<{official:BankCard|null,source:SearchResponse}>{
  let token="";
  const session=cloud?await cloud.auth.getSession():null;
  token=session?.data.session?.access_token||"";
  const demo=["7707083893","7702070139","7728168971"].includes(inn)||(inn==="7744001497"&&ogrn==="1027700167110");
  if(!token&&!demo)throw new Error("Для поиска другого ИНН требуется вход в аккаунт.");
  const args=new URLSearchParams({mode:demo&&!token?"demo":"lookup",inn});
  if(ogrn)args.set("ogrn",ogrn);
  const resp=await fetch(RESEARCH_API+"?"+args.toString(),{headers:{Accept:"application/json",...(token?{Authorization:"Bearer "+token}:{})}});
  const result=await resp.json() as SearchResponse;
  if(!resp.ok||!result.ok)throw new Error(result.error||"Сервис поиска недоступен");
  return {official:result.official??null,source:result};
}
export async function connectionChecks(userId:string):Promise<{name:string,ok:boolean,message:string}[]>{
  const sb=requireCloud();
  const checks: {name:string,ok:boolean,message:string}[]=[];
  const probes=[
    {name:"Авторизация",run:async()=>{const r=await sb.auth.getUser();if(r.error||r.data.user?.id!==userId)throw new Error("Сессия не подтверждена");}},
    {name:"Компании и RLS",run:async()=>{const r=await sb.from("na2_companies").select("id").limit(1);if(r.error)throw r.error;}},
    {name:"Продукция",run:async()=>{const r=await sb.from("na2_products").select("id").limit(1);if(r.error)throw r.error;}},
    {name:"Закупки",run:async()=>{const r=await sb.from("na2_procurements").select("id").limit(1);if(r.error)throw r.error;}},
    {name:"Суды",run:async()=>{const r=await sb.from("na2_court_cases").select("id").limit(1);if(r.error)throw r.error;}},
  ];
  for(const p of probes){try{await p.run();checks.push({name:p.name,ok:true,message:"Сервер ответил"});}catch(e){checks.push({name:p.name,ok:false,message:e instanceof Error?e.message:"Не удалось подключиться"});}}
  return checks;
}
