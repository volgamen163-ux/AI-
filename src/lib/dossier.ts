import type { Company, Product, MarketOffer, Workspace } from "./types";
import { toCsv } from "./validation";

export type DossierProduct = { product: Product; offers: MarketOffer[]; medianRub: number | null };
export type Dossier = {
 company: Company; products: DossierProduct[];
 procurements: Workspace["procurements"]; courts: Workspace["courts"];
 relations: Workspace["relations"];
 participation: number; wins: number; contracts: number; contractValue: number;
 sourceCount: number; recordCount: number; isDemo: boolean;
};

export function buildDossier(data: Workspace, companyId: string, includeDemo = false): Dossier | null {
 const company = data.companies.find(x => x.id === companyId);
 if (!company) return null;
 const own = data.products.filter(x => x.company_id === companyId);
 const products = own.map(product => {
   const offers = data.offers.filter(x => x.product_id === product.id);
   const prices = offers.filter(x => x.currency === "RUB")
     .map(x => Number(x.unit_price)).filter(x => Number.isFinite(x) && x >= 0).sort((a,b) => a-b);
   const n = prices.length;
   const medianRub = n ? (n % 2 ? prices[Math.floor(n/2)] : (prices[n/2-1]+prices[n/2])/2) : null;
   return {product, offers, medianRub};
 });
 const procurements = data.procurements.filter(x => x.company_id === companyId && (includeDemo || !x.is_demo));
 const courts = data.courts.filter(x => x.company_id === companyId && (includeDemo || !x.is_demo));
 const relations = data.relations.filter(x => x.company_a === companyId || x.company_b === companyId);
 const linked = [
   company.source_url, ...own.map(x=>x.source_url), ...products.flatMap(x=>x.offers.map(o=>o.source_url)),
   ...procurements.map(x=>x.source_url),...courts.map(x=>x.source_url),...relations.map(x=>x.source_url),
 ];
 const contracts = procurements.filter(x => x.event_type === "contract");
 return {
   company,products,procurements,courts,relations,isDemo:includeDemo,
   participation:procurements.filter(x=>x.event_type==="participation").length,
   wins:procurements.filter(x=>x.event_type==="win").length,
   contracts:contracts.length,
   contractValue:contracts.reduce((sum,x)=>sum+(x.amount!=null&&Number.isFinite(Number(x.amount))&&Number(x.amount)>=0?Number(x.amount):0),0),
   sourceCount:linked.filter(s=>typeof s==="string"&&/^https?:\/\//i.test(s)).length,
   recordCount:1+own.length+products.reduce((s,x)=>s+x.offers.length,0)+procurements.length+courts.length+relations.length,
 };
}
export function dossierCsv(d: Dossier): string {
 const rows: unknown[][]=[];
 const add=(section:string,name:string,value:unknown,status:string,source?:string|null)=>{
   rows.push([section,name,value==null?"":value,status,source||""]);
 };
 const s=(status?:string)=>status||"unverified";
 add("Компания","Наименование",d.company.name,s(d.company.verification_status),d.company.source_url);
 add("Компания","ИНН",d.company.inn,s(d.company.verification_status),d.company.source_url);
 add("Компания","ОГРН",d.company.ogrn,s(d.company.verification_status),d.company.source_url);
 d.products.forEach(({product,offers})=>{
   add("Продукция",product.name,product.availability,"Наличие не проверялось онлайн",product.source_url);
   offers.forEach(o=>add("Рынок",product.name+" / "+o.seller_name,
     o.unit_price+" "+o.currency+" / "+product.unit,s(o.verification_status),o.source_url));
 });
 d.procurements.forEach(x=>add("Закупки: "+x.event_type,x.procedure_number+" / "+x.customer,
   x.amount==null?"Сумма неизвестна":x.amount+" RUB",s(x.verification_status),x.source_url));
 d.courts.forEach(x=>add("Суд: "+x.role,x.case_number+" / "+x.court_name,
   x.stage+"; требования: "+(x.claim_amount==null?"не указаны":x.claim_amount+" RUB"),
   s(x.verification_status),x.source_url));
 d.relations.forEach(x=>add("Возможная связь",x.signal_type,x.signal_value,s(x.verification_status),x.source_url));
 add("Ограничения","Полнота","Отсутствие записей не подтверждает отсутствия судов и закупок","Методология");
 add("Ограничения","Договор","Договор не доказывает победу в закупке","Методология");
 if(d.isDemo)add("Ограничения","ДЕМО","Вымышленные учебные данные","Методология");
 return toCsv(["Раздел","Показатель","Значение","Статус проверки","Первоисточник"],rows);
}
