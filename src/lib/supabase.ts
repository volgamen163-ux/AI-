import { createClient } from "@supabase/supabase-js";
const url=import.meta.env.VITE_SUPABASE_URL?.trim();
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configured=Boolean(url&&key&&/^https:\/\//.test(url));
export const supabase=configured?createClient(url!,key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const researchEndpoint=import.meta.env.VITE_RESEARCH_API?.trim()||((url||"").replace(/\/$/,"")+"/functions/v1/nexus-company-research");
