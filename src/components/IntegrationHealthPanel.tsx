import { useState } from "react";
import { Activity, CheckCircle2, CircleAlert, LockKeyhole, RefreshCw } from "lucide-react";
import { runIntegrationHealth, type HealthResult } from "../lib/health";

export function IntegrationHealthPanel({ signedIn }: { signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<HealthResult[] | null>(null);
  const [checkedAt, setCheckedAt] = useState("");

  async function check() {
    if (busy) return;
    setBusy(true);
    setItems(null);
    try {
      setItems(await runIntegrationHealth(signedIn));
      setCheckedAt(new Date().toLocaleString("ru-RU"));
    } catch (error) {
      setItems([{
        id: "unhandled",
        name: "Диагностика",
        status: "error",
        detail: error instanceof Error ? error.message.slice(0, 150) : "Неизвестная ошибка",
      }]);
    } finally {
      setBusy(false);
    }
  }

  const ok = items?.filter((x) => x.status === "ok").length || 0;
  return (
    <section className="panel" aria-label="Живая диагностика подключений" style={{ padding: 20, marginBottom: 22 }}>
      <div className="panel-top">
        <h2 style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Activity size={19} /> Диагностика инфраструктуры
        </h2>
        <button className="btn line" type="button" onClick={() => void check()} disabled={busy}>
          <RefreshCw size={16} className={busy ? "spin" : undefined} />
          {busy ? "Проверяем…" : "Запустить тест"}
        </button>
      </div>
      <p className="muted">
        Фактические запросы к шлюзу, списку источников, Supabase Auth и таблицам.
        Зелёный статус появляется только после ответа. Тесты не изменяют данные.
      </p>
      {items && (
        <div aria-live="polite" style={{ display: "grid", gap: 9, marginTop: 16 }}>
          <div className="muted" style={{ fontSize: 12 }}>{ok} из {items.length} успешных · {checkedAt}</div>
          {items.map((item) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "flex-start", gap: 9,
              border: "1px solid var(--line, #e6ebf0)", borderRadius: 12, padding: "11px 13px"
            }}>
              {item.status === "ok" ? <CheckCircle2 size={18} color="#258765"/> :
               item.status === "requires_login" ? <LockKeyhole size={18} color="#aa864c"/> :
               <CircleAlert size={18} color="#c75f55"/>}
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{item.name}</strong>
                <div className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        Ответ таблицы не заменяет тест изоляции двух пользователей.
        Статус шлюза не означает, что ЕИС, ФНС и КАД подключены как полные API.
      </p>
    </section>
  );
}
