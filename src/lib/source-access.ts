import { supabase } from "./supabase";

export const SOURCES = [
  {
    id: "fns_bulk", name: "ФНС · ЕГРЮЛ/ЕГРИП",
    description: "Регистрационные сведения, руководство, ОКВЭД, реквизиты",
    publicUrl: "https://www.nalog.gov.ru/",
    instruction: "Получить условия доступа на сайте ФНС, выбрать нужный реестр и способ выгрузки. Для массовой передачи могут потребоваться договор, оплата и сертификат. Сертификаты не загружай в эту форму.",
    technical: "FTP/XML или другой официальный канал по выданным параметрам. Сначала тестовая выгрузка и проверка формата.",
  },
  {
    id: "eis_soi", name: "ЕИС · Закупки 44-ФЗ и 223-ФЗ",
    description: "Извещения, закупки, участники по доступным данным, результаты и договоры",
    publicUrl: "https://zakupki.gov.ru/",
    instruction: "Проверить порядок подключения к сервису отдачи информации (СОИ) ЕИС и допустимый объём сведений. Оформить необходимые права в личном кабинете оператора.",
    technical: "Разрешённый SOAP/REST/XML-интерфейс или официальные выгрузки с контролем версий схем и идентификаторов процедур.",
  },
  {
    id: "kad_provider", name: "КАД · Арбитражные дела",
    description: "Номера дел, роли сторон, этапы и ссылки на судебные документы",
    publicUrl: "https://kad.arbitr.ru/",
    instruction: "Уточнить у правообладателя сервиса или законного поставщика данных доступность программного интерфейса, лицензию и права на использование. Не обходить ограничения сайта.",
    technical: "Только подтверждённый разрешённый API/поставщик или импорт собственных выгрузок; автоматический сбор без прав не активируется.",
  },
] as const;

export type SourceId = typeof SOURCES[number]["id"];
export type RequestStatus = "not_started" | "preparing" | "submitted" | "access_issued";
export type AccessEntry = { source_id: SourceId; request_status: RequestStatus; reference_number: string; updated_at?: string };
export const REQUEST_STAGES: {id:RequestStatus; title:string}[] = [
  {id:"not_started", title:"Не начинали"},
  {id:"preparing", title:"Готовим документы"},
  {id:"submitted", title:"Заявка подана"},
  {id:"access_issued", title:"Доступ предоставлен (по вашим сведениям)"},
];

export function blankAccess(): Record<SourceId, AccessEntry> {
  return Object.fromEntries(SOURCES.map(x=>[x.id,{source_id:x.id,request_status:"not_started",reference_number:""}])) as Record<SourceId, AccessEntry>;
}
export function validateReference(value: string): string {
  const text = value.trim();
  if (text.length > 120) throw Error("Номер заявки: не более 120 символов");
  if (/[\r\n=<>]/.test(text)) throw Error("Номер заявки содержит недопустимые символы");
  if (/(?:password|passwd|token|secret|api[_ -]?key|парол|токен|ключ)\s*[:=]/i.test(text))
    throw Error("Не вводите сюда пароли, ключи или токены");
  return text;
}
export function isRequestStatus(value: unknown): value is RequestStatus {
  return REQUEST_STAGES.some(x=>x.id===value);
}
export function normalizeAccess(rows: unknown): Record<SourceId,AccessEntry> {
  const state = blankAccess();
  if (!Array.isArray(rows)) return state;
  for (const row of rows) {
    if (!row || typeof row!=="object") continue;
    const x=row as Partial<AccessEntry>;
    if (SOURCES.some(s=>s.id===x.source_id)&&isRequestStatus(x.request_status)) {
      const source=x.source_id as SourceId;
      state[source]={source_id:source,request_status:x.request_status,reference_number:String(x.reference_number||"").slice(0,120),updated_at:x.updated_at};
    }
  }
  return state;
}
export async function readSourceAccess(userId: string): Promise<Record<SourceId,AccessEntry>> {
  if (!supabase) throw Error("Supabase не настроен");
  const {data,error}=await supabase.from("na2_source_access")
    .select("source_id,request_status,reference_number,updated_at")
    .eq("user_id",userId);
  if (error) throw Error("Не удалось получить заявки: "+error.message);
  return normalizeAccess(data);
}
export async function writeSourceAccess(userId:string,entry:AccessEntry):Promise<void> {
  if(!supabase)throw Error("Supabase не настроен");
  if (!SOURCES.some(x=>x.id===entry.source_id)||!isRequestStatus(entry.request_status)) throw Error("Недопустимый источник или статус");
  const ref=validateReference(entry.reference_number);
  const {error}=await supabase.from("na2_source_access").upsert({
    user_id:userId,source_id:entry.source_id,
    request_status:entry.request_status,reference_number:ref,updated_at:new Date().toISOString(),
  },{onConflict:"user_id,source_id"});
  if(error)throw Error("Не удалось сохранить статус: "+error.message);
}
