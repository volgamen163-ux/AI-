import { supabase } from "./supabase";
import type { Workspace, EntityKind } from "./types";
import { EMPTY_WORKSPACE } from "./types";
const map = {
 companies:"na2_companies", products:"na2_products",procurements:"na2_procurements",
 courts:"na2_court_cases", offers:"na2_market_offers",relations:"na2_company_relations"
} as const;
export async function loadWorkspace():Promise<Workspace>{
 const client=supabase;if(!client)throw new Error("Supabase не настроен");
 const names=Object.keys(map) as (keyof typeof map)[];
 const responses=await Promise.all(names.map(key=>client.from(map[key]).select("*").limit(1000)));
 for(let i=0;i<responses.length;i++)if(responses[i].error)throw new Error(names[i]+": "+responses[i].error!.message);
 const data:Record<string,unknown>={...EMPTY_WORKSPACE};
 for(let i=0;i<names.length;i++)data[names[i]]=responses[i].data||[];
 return data as Workspace;
}
export async function insertRow(kind:EntityKind,userId:string,row:Record<string,unknown>):Promise<void>{
 if(!supabase)throw new Error("Supabase не настроен");
 const {error}=await supabase.from(map[kind==="company"?"companies":kind==="product"?"products":kind==="procurement"?"procurements":kind==="court"?"courts":"offers"]).insert({user_id:userId,...row});
 if(error)throw new Error(error.message);
}
export async function deleteRow(table:keyof typeof map,id:string):Promise<void>{
 if(!supabase)throw new Error("Supabase не настроен");
 const {error}=await supabase.from(map[table]).delete().eq("id",id);
 if(error)throw new Error(error.message);
}

export type IngestionJob = {
  id: string;
  provider: string;
  status: "pending" | "running" | "complete" | "failed";
  input_metadata: { filename?: string; kind?: string } | null;
  counters: { total?: number; valid?: number; rejected?: number; inserted?: number; failed?: number } | null;
  error_message: string | null;
  started_at: string;
};
export async function getImportJobs(): Promise<IngestionJob[]> {
  if (!supabase) throw Error("Supabase не настроен");
  const { data, error } = await supabase.from("na2_ingestion_jobs")
    .select("id,provider,status,input_metadata,counters,error_message,started_at")
    .order("started_at", { ascending: false }).limit(20);
  if (error) throw Error(error.message);
  return (data || []) as IngestionJob[];
}
export async function startImportJob(
  userId: string, provider: string, metadata: Record<string, unknown>, counters: Record<string, number>,
): Promise<string> {
  if (!supabase) throw Error("Supabase не настроен");
  const { data, error } = await supabase.from("na2_ingestion_jobs")
    .insert({ user_id: userId, provider, status: "running", input_metadata: metadata, counters })
    .select("id").single();
  if (error || !data?.id) throw Error(error?.message || "Журнал не создан");
  return String(data.id);
}
export async function endImportJob(
  userId: string, id: string, status: "complete" | "failed", counters: Record<string, number>, message: string | null,
): Promise<void> {
  if (!supabase) throw Error("Supabase не настроен");
  const { data, error } = await supabase.from("na2_ingestion_jobs")
    .update({ status, counters, error_message: message, finished_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).select("id").single();
  if (error || !data) throw Error(error?.message || "Журнал не обновлён");
}
