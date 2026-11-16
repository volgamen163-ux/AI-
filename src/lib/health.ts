import { researchEndpoint, supabase } from "./supabase";

export type HealthStatus = "ok" | "error" | "requires_login";
export type HealthResult = { id: string; name: string; status: HealthStatus; detail: string };
export type HealthProbe = { id: string; name: string; check: () => Promise<string> };

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 150);
}

export async function runProbes(probes: HealthProbe[], timeoutMs = 8500): Promise<HealthResult[]> {
  const results: HealthResult[] = [];
  for (const probe of probes) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const detail = await Promise.race([
        probe.check(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Превышено время ожидания")), timeoutMs);
        }),
      ]);
      results.push({ id: probe.id, name: probe.name, status: "ok", detail: detail.slice(0, 150) });
    } catch (error) {
      results.push({ id: probe.id, name: probe.name, status: "error", detail: errorText(error) });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return results;
}

async function serverJson(mode: string) {
  if (!researchEndpoint.startsWith("https://")) throw Error("Не настроен сервер исследования");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const url = new URL(researchEndpoint);
    url.searchParams.set("mode", mode);
    const response = await fetch(url.toString(), { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw Error("HTTP " + response.status);
    const json: unknown = await response.json();
    if (!json || typeof json !== "object" || !("ok" in json) || json.ok !== true)
      throw Error("Некорректный ответ сервиса");
    return json as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

/** No login? Mark private checks as restricted, never green. No database writes. */
export async function runIntegrationHealth(signedIn: boolean): Promise<HealthResult[]> {
  const probes: HealthProbe[] = [
    {
      id: "research",
      name: "Шлюз исследования компаний",
      check: async () => {
        const data = await serverJson("health");
        return "Ответ сервера получен · версия " + String(data.version || "не указана");
      },
    },
    {
      id: "providers",
      name: "Реестр интеграций",
      check: async () => {
        const data = await serverJson("providers");
        if (!Array.isArray(data.providers) || !data.providers.length) throw Error("Список источников пуст");
        const live = data.providers.filter((x) =>
          Boolean(x && typeof x === "object" && "status" in x && x.status === "live_partial")
        ).length;
        return "Источников: " + data.providers.length + " · частично работает: " + live;
      },
    },
  ];
  if (!signedIn || !supabase) {
    const result = await runProbes(probes);
    return result.concat([
      { id: "auth", name: "Авторизация", status: "requires_login", detail: "Войдите в аккаунт" },
      { id: "data", name: "Доступ к 6 таблицам аналитики", status: "requires_login", detail: "Войдите в аккаунт" },
    ]);
  }
  probes.push(
    {
      id: "auth",
      name: "Авторизация Supabase",
      check: async () => {
        const { data, error } = await supabase!.auth.getUser();
        if (error) throw error;
        if (!data.user) throw Error("Сеанс не подтверждён");
        return "Сеанс подтверждён сервером";
      },
    },
    {
      id: "data",
      name: "Доступ к 6 таблицам аналитики",
      check: async () => {
        const tables = [
          "na2_companies", "na2_products", "na2_procurements",
          "na2_court_cases", "na2_market_offers", "na2_company_relations",
        ];
        const answers = await Promise.all(tables.map((table) =>
          supabase!.from(table).select("id", { head: true, count: "exact" })
        ));
        const failed = answers.findIndex((x) => x.error);
        if (failed !== -1) throw Error(tables[failed] + ": " + answers[failed].error!.message);
        return "6 из 6 таблиц ответили (данные защищены RLS)";
      },
    },
  );
  return runProbes(probes);
}
