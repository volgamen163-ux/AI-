import { supabase } from "./supabase";
import type { Workspace, EntityKind } from "./types";
import { EMPTY_WORKSPACE } from "./types";
const map = {
 companies:"na2_companies", products:"na2_products",procurements:"na2_procurements",
 courts:"na2_court_cases", offers:"na2_market_offers",relations:"na2_company_relations"
} as const;
export async function loadWorkspace():Promise<Workspace>{
 if(!supabase)throw new Error("Supabase не настроен");
 const names=Object.keys(map) as (keyof typeof map)[];
 const responses=await Promise.all(names.map(key=>supabase.from(map[key]).select("*").limit(1000)));
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
