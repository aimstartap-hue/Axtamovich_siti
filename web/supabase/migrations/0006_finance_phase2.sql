-- =============================================================================
-- Moliya bloki Phase 2 — baza kengaytmasi (2026-07)
-- Bu faylni Supabase SQL Editor'da BIR MARTA ishga tushiring.
-- Barcha amallar "if not exists" — qayta ishga tushirsa ham xavfsiz.
-- =============================================================================

-- --- Punkt 7: filial + KATEGORIYA byudjeti -----------------------------------
-- category = '' bo'lsa — filialning umumiy byudjeti (avvalgidek).
alter table budgets add column if not exists category text not null default '';
alter table budgets drop constraint if exists budgets_branch_id_month_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_branch_month_cat_key') then
    alter table budgets add constraint budgets_branch_month_cat_key unique (branch_id, month, category);
  end if;
end $$;

-- --- Punkt 16: to'lov holati -------------------------------------------------
alter table requests add column if not exists paid boolean not null default false;
alter table requests add column if not exists paid_at timestamptz;

-- --- Punkt 4: valyuta kurslari (CBU) -----------------------------------------
-- 1 birlik valyuta = rate so'm. CBU API'dan yangilanadi.
create table if not exists exchange_rates (
  org_id      uuid not null references organizations(id) on delete cascade,
  currency    text not null,                 -- 'USD', 'EUR', 'RUB', ...
  rate        numeric not null,              -- 1 currency = rate so'm
  updated_at  timestamptz not null default now(),
  unique (org_id, currency)
);
alter table exchange_rates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='exchange_rates' and policyname='exchange_rates_select') then
    create policy exchange_rates_select on exchange_rates for select using (org_id = auth_org_id());
    create policy exchange_rates_insert on exchange_rates for insert with check (org_id = auth_org_id());
    create policy exchange_rates_update on exchange_rates for update using (org_id = auth_org_id());
    create policy exchange_rates_delete on exchange_rates for delete using (org_id = auth_org_id());
  end if;
end $$;

-- --- Punkt 19: audit jurnali (byudjet/limit/sozlama o'zgarishlari) ------------
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  actor_id    uuid references profiles(id),
  action      text not null,                 -- 'budget' | 'limit' | 'threshold' | ...
  detail      text,
  created_at  timestamptz not null default now()
);
alter table audit_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='audit_log' and policyname='audit_log_select') then
    create policy audit_log_select on audit_log for select using (org_id = auth_org_id());
    create policy audit_log_insert on audit_log for insert with check (org_id = auth_org_id());
  end if;
end $$;

create index if not exists idx_audit_org on audit_log(org_id, created_at desc);
