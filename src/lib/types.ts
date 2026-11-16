export type EvidenceStatus = "unverified" | "source_linked" | "user_verified" | "official_verified";
export type SourceRecord = { source_url?: string | null; source_provider?: string; verification_status?: EvidenceStatus; checked_at?: string | null };
export type Company = SourceRecord & {
  id: string; user_id?: string; inn: string; ogrn?: string | null; name: string; region: string; activity: string;
  website?: string | null; director?: string | null; legal_address?: string | null; email?: string | null; phone?: string | null;
  created_at?: string; updated_at?: string
};
export type Product = {
  id: string; user_id?: string; company_id: string; name: string; category: string; unit: string;
  sku?: string | null; availability: "unknown" | "in_stock" | "on_request" | "out_of_stock";
  stock_qty?: number | null; source_url?: string | null; source_date?: string | null
};
export type Procurement = SourceRecord & {
  id: string; user_id?: string; company_id: string; procedure_number: string; customer: string;
  event_type: "participation" | "win" | "contract" | "other"; law: "44-FZ" | "223-FZ" | "other" | "unknown";
  amount?: number | null; occurred_at?: string | null; is_demo: boolean
};
export type CourtCase = SourceRecord & {
  id: string; user_id?: string; company_id: string; case_number: string; court_name: string;
  role: "plaintiff" | "defendant" | "third_party" | "other" | "unknown"; stage: string;
  claim_amount?: number | null; filed_at?: string | null; is_demo: boolean
};
export type MarketOffer = SourceRecord & {
  id: string; user_id?: string; product_id: string; seller_name: string; unit_price: number; currency: string;
  stock_status: "unknown" | "in_stock" | "on_request" | "out_of_stock"; observed_at: string
};
export type CompanyRelation = SourceRecord & {
 id: string; user_id?: string; company_a: string; company_b: string;
 signal_type: "director" | "address" | "phone" | "email" | "founder" | "other"; signal_value: string
};
export type Workspace = {
 companies: Company[]; products: Product[]; procurements: Procurement[]; courts: CourtCase[];
 offers: MarketOffer[]; relations: CompanyRelation[]
};
export const EMPTY_WORKSPACE: Workspace = { companies: [], products: [], procurements: [], courts: [], offers: [], relations: [] };
export type View = "overview" | "companies" | "products" | "procurements" | "courts" | "relations" | "sources" | "imports";
export type EntityKind = "company" | "product" | "procurement" | "court" | "offer";
