# NEXUS ANALYTICS v2

Единая аналитическая платформа компаний, закупок, судов, товаров и цен. Реальные данные и демо изолированы. Исходные таблицы Supabase защищены RLS.

## Разработка

```bash
npm install
cp .env.example .env.local
npm run dev
npm run typecheck
npm run test
npm run build
```

### Среды

- Github: `volgamen163-ux/AI-`, ветка `nexus-analytics-v2-staging`.
- Supabase: `mjqicmrwstqypwnvtkyf`, таблицы `na2_*`.
- Edge: `nexus-company-research`.
- Original v1.0: `https://nexus-analytics-hub-volgamen163-1027.vercel.app/` — не затронут.

## Безопасность

Только публичный `sb_publishable_` key в Vite. `service_role` запрещён в UI. Совпадения директоров, адресов и телефонов — сигналы, а не установленные факты. Договор ≠ победа. Сумма судебного иска ≠ долг. Подробности в `docs/ARCHITECTURE.md`.
