import type { Company, CourtCase, MarketOffer, Procurement, Product, Relation, Workspace } from "../types";

export function validInn(inn: string): boolean {
  if (!/^\d{10}(\d{2})?$/.test(inn)) return false;
  const n = [...inn].map(Number);
  const sum = (weights: number[]) => weights.reduce((acc, weight, i) => acc + weight * n[i], 0) % 11 % 10;
  return inn.length === 10
    ? sum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === n[9]
    : sum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === n[10] && sum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === n[11];
}
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}
export function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value) + " ₽" : "Не указано";
}
export function sourceLabel(status: string): string {
  return ({ official_verified: "Проверено в реестре", user_verified: "Проверено пользователем", source_linked: "Есть ссылка", unverified: "Не подтверждено" } as Record<string,string>)[status] || "Не подтверждено";
}
export function statistics(data: Workspace) {
  const tenders = data.tenders.filter(x => !x.is_demo);
  const cases = data.cases.filter(x => !x.is_demo);
  return {
    companies: data.companies.length,
    products: data.products.length,
    participation: tenders.filter(x => x.event_type === "participation").length,
    declaredWins: tenders.filter(x => x.event_type === "win").length,
    contracts: tenders.filter(x => x.event_type === "contract").length,
    cases: cases.length,
    claimSum: cases.reduce((a, x) => a + (x.claim_amount ?? 0), 0),
    contractSum: tenders.filter(x => x.event_type === "contract").reduce((a, x) => a + (x.amount ?? 0), 0),
  };
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i-1] + sorted[i]) / 2;
}
export function productInsight(product: Product, offers: MarketOffer[]) {
  const comparable = offers.filter(x => x.product_id === product.id && x.currency === "RUB" && x.unit_price >= 0);
  const prices = comparable.map(x => x.unit_price);
  const min = prices.length ? Math.min(...prices) : null;
  return { sampleSize: comparable.length, minimum: min, median: median(prices), inStock: comparable.filter(x => x.stock_status === "in_stock").length,
    caveat: "Предложения из загруженной выборки, не полный рынок; цены могут иметь разную комплектацию, НДС и дату." };
}
export function relationSignals(relations: Relation[], companies: Company[]) {
  return relations.map(r => ({
    ...r, left: companies.find(c => c.id === r.company_a)?.name ?? "Неизвестная компания",
    right: companies.find(c => c.id === r.company_b)?.name ?? "Неизвестная компания",
    conclusion: "Совпадение — индикатор для проверки, не юридическое доказательство аффилированности.",
  }));
}
export function companyScope(data: Workspace, companyId: string) {
  return { company: data.companies.find(c => c.id === companyId),
    products: data.products.filter(p => p.company_id === companyId),
    tenders: data.tenders.filter(t => t.company_id === companyId && !t.is_demo),
    cases: data.cases.filter(c => c.company_id === companyId && !c.is_demo),
    relations: data.relations.filter(r => r.company_a === companyId || r.company_b === companyId) };
}
export function procurementSummary(rows: Procurement[]) {
  const list = rows.filter(x => !x.is_demo);
  return {
    participation: list.filter(x => x.event_type === "participation").length,
    wins: list.filter(x => x.event_type === "win").length,
    contracts: list.filter(x => x.event_type === "contract").length,
    totalContracts: list.filter(x => x.event_type === "contract").reduce((a,x) => a + (x.amount ?? 0), 0),
  };
}
export function courtSummary(rows: CourtCase[]) {
  const list = rows.filter(c => !c.is_demo);
  return { plaintiff: list.filter(c => c.role === "plaintiff").length, defendant: list.filter(c => c.role === "defendant").length, thirdParty: list.filter(c => c.role === "third_party").length,
    claimAmount: list.reduce((a,x) => a+(x.claim_amount ?? 0),0) };
}
