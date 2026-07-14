-- =============================================================================
-- 0010 — Aktivlar modulini kengaytirish (holat, mas'ul, narx, joylashuv, tarix).
-- Miqyos: indekslar + FK; RLS org bo'yicha. Idempotent (if not exists).
-- =============================================================================

-- --- assets ustunlari ---
alter table assets add column if not exists inventory_no     text;
alter table assets add column if not exists status           text not null default 'active'; -- active|repair|moved|lost|written_off
alter table assets add column if not exists location         text;                            -- xona/joylashuv
alter table assets add column if not exists assignee_id      uuid references profiles(id);
alter table assets add column if not exists price            numeric;
alter table assets add column if not exists last_inventory_at timestamptz;
alter table assets add column if not exists photos_json      jsonb not null default '[]'::jsonb;
alter table assets add column if not exists docs_json        jsonb not null default '[]'::jsonb;
alter table assets add column if not exists updated_at       timestamptz not null default now();

-- Inventar raqami noyob (org ichida) — bo'sh bo'lmaganlarda
create unique index if not exists uq_assets_invno on assets(org_id, inventory_no) where inventory_no is not null;

-- Qidiruv/filtr indekslari (100+ filial, millionlab aktiv uchun)
create index if not exists idx_assets_org       on assets(org_id);
create index if not exists idx_assets_branch    on assets(branch_id);
create index if not exists idx_assets_status    on assets(status);
create index if not exists idx_assets_assignee  on assets(assignee_id);
create index if not exists idx_assets_category  on assets(category);
create index if not exists idx_assets_purchase  on assets(purchase_date);

-- --- asset_events: to'liq tarix (transfer / ta'mir / inventarizatsiya / holat) ---
create table if not exists asset_events (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  asset_id    bigint not null references assets(id) on delete cascade,
  kind        text not null,           -- transfer | repair | inventory | status | note
  from_ref    text,                    -- eski qiymat (filial/mas'ul/holat)
  to_ref      text,                    -- yangi qiymat
  amount      numeric,                 -- ta'mir summasi
  note        text,
  actor_id    uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_asset_events_asset on asset_events(asset_id, created_at desc);
create index if not exists idx_asset_events_org   on asset_events(org_id);
create index if not exists idx_asset_events_kind  on asset_events(asset_id, kind);

-- --- RLS: faqat o'z organizatsiyasi ---
alter table asset_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'asset_events' and policyname = 'asset_events_org') then
    create policy asset_events_org on asset_events for all
      using (org_id = auth_org_id()) with check (org_id = auth_org_id());
  end if;
end $$;
