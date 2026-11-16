import type { Company, MarketOffer, Procurement, Product, Workspace, CompanyRelation } from "./types";
import { norm } from "./validation";
export function procurementMetrics(procs: Procurement[]) {
 const real = procs.filter(p => !p.is_demo);
 const count = (type: Procurement["event_type"]) => real.filter(p => p.event_type === type).length;
 return {
  participation: count("participation"), wins: count("win"), contracts: count("contract"),
  other: count("other"),
  contractValue: real.filter(p=>p.event_type==="contract").reduce((a,p)=>a+(Number(p.amount)||0),0),
  sourceLinked: real.filter(p=>Boolean(p.source_url)).length
 };
}
export function marketStats(offers: MarketOffer[]) {
 const prices=offers.map(o=>Number(o.unit_price)).filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
 if (!prices.length) return null;
 const middle=Math.floor(prices.length/2);
 return { count:prices.length, min:prices[0], max:prices[prices.length-1], median:prices.length%2?prices[middle]:(prices[middle-1]+prices[middle])/2,
 inStock:offers.filter(o=>o.stock_status==="in_stock").length };
}
export type RelationSignal = { a: Company; b: Company; field: "director"|"legal_address"|"phone"|"email"; evidence: string; verified: false };
export function automaticSignals(companies:Company[]): RelationSignal[] {
 const fields = ["director","legal_address","phone","email"] as const;
 const result:RelationSignal[]=[];
 for(let i=0;i<companies.length;i++)for(let j=i+1;j<companies.length;j++) {
  const a=companies[i],b=companies[j];
  if(a.inn===b.inn)continue;
  for(const field of fields){
    const av=a[field]||"",bv=b[field]||"";
    const x=field==="phone"?av.replace(/\D/g,"").replace(/^8(?=\d{10}$)/,"7"):norm(av);
    const y=field==="phone"?bv.replace(/\D/g,"").replace(/^8(?=\d{10}$)/,"7"):norm(bv);
    if(x.length >= (field==="legal_address"?16:field==="email"?6:7) && x===y)result.push({a,b,field,evidence:av,verified:false});
  }
 }
 return result;
}
export function summary(w:Workspace){
 const pr=procurementMetrics(w.procurements);
 return {companies:w.companies.length,products:w.products.length,procurements:w.procurements.filter(x=>!x.is_demo).length,
 courts:w.courts.filter(x=>!x.is_demo).length,marketOffers:w.offers.length,
 linked:w.companies.filter(x=>x.source_url).length,signals:automaticSignals(w.companies).length+w.relations.length,
 contractValue:pr.contractValue};
}
export function companyContext(w:Workspace,id:string){
 return {products:w.products.filter(x=>x.company_id===id),procurements:w.procurements.filter(x=>x.company_id===id),
 courts:w.courts.filter(x=>x.company_id===id),relations:w.relations.filter(x=>x.company_a===id||x.company_b===id)};
}
export function productOffers(w:Workspace,p:Product){return w.offers.filter(o=>o.product_id===p.id);}
export function companyName(w:Workspace,id:string){return w.companies.find(x=>x.id===id)?.name||"Неизвестная компания";}
export function productName(w:Workspace,id:string){return w.products.find(x=>x.id===id)?.name||"Неизвестный товар";}
export function relationLabel(r:CompanyRelation){return ({director:"Руководитель",address:"Адрес",phone:"Телефон",email:"Email",founder:"Учредитель",other:"Другое"} as const)[r.signal_type];}
