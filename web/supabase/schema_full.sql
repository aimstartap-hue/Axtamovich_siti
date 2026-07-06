-- =============================================================================
-- AXO-OPEN group — Supabase sxemasi (multi-tenant SaaS)
-- Har bir korxona (organization) faqat o'z ma'lumotini ko'radi (RLS orqali).
-- =============================================================================

-- --- ORGANIZATIONS (korxonalar) -------------------------------------------------
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- --- PROFILES (foydalanuvchi = auth.users bilan bog'liq) ------------------------
-- role: admin | oper | branch_manager | regmen | axo | finance | ceo | ops_director | open_group | hr
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'branch_manager',
  branch_id   bigint,
  created_at  timestamptz not null default now()
);

-- --- BRANCHES (filiallar) ------------------------------------------------------
create table if not exists branches (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  status      text not null default 'active',   -- 'active' | 'construction'
  regmen_id   uuid references profiles(id),
  created_at  timestamptz not null default now()
);

-- --- USER_BRANCHES (menejer/regmen bir necha filialga) -------------------------
create table if not exists user_branches (
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  branch_id   bigint not null references branches(id) on delete cascade,
  unique (user_id, branch_id)
);

-- --- REQUESTS (zayavkalar) -----------------------------------------------------
create table if not exists requests (
  id                  bigint generated always as identity primary key,
  org_id              uuid not null references organizations(id) on delete cascade,
  type                text not null,             -- 'maintenance' | 'new_branch'
  title               text not null,
  description         text,
  branch_id           bigint references branches(id),
  created_by          uuid not null references profiles(id),
  status              text not null,
  deadline            date,
  deadline_confirmed  boolean not null default false,
  rejected_by         uuid,
  suggested_deadline  date,
  deadline_disputed   boolean not null default false,
  limit_amount        numeric,
  limit_type          text default 'soft',       -- 'soft' | 'hard'
  photos_json         jsonb default '[]'::jsonb,
  estimated_amount    numeric,
  estimated_currency  text default 'so''m',
  estimated_category  text,
  escalated           boolean not null default false,
  created_at          timestamptz not null default now()
);

-- --- EVENTS (zayavka tarixi) ---------------------------------------------------
create table if not exists events (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  request_id  bigint not null references requests(id) on delete cascade,
  user_id     uuid references profiles(id),
  action      text not null,
  comment     text,
  created_at  timestamptz not null default now()
);

-- --- REPORTS (foto-hisobotlar) -------------------------------------------------
create table if not exists reports (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references organizations(id) on delete cascade,
  request_id    bigint not null references requests(id) on delete cascade,
  note          text,
  total         numeric default 0,
  photos_json   jsonb default '[]'::jsonb,
  submitted_by  uuid references profiles(id),
  created_at    timestamptz not null default now()
);

-- --- REPORT_ITEMS (hisobot qatorlari) ------------------------------------------
create table if not exists report_items (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  report_id   bigint not null references reports(id) on delete cascade,
  name        text not null,
  category    text,
  supplier    text,
  qty         numeric default 1,
  price       numeric default 0
);

-- --- NOTIFICATIONS (bildirishnomalar) ------------------------------------------
create table if not exists notifications (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  request_id  bigint references requests(id) on delete cascade,
  text        text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- --- COMMENTS (izohlar/chat) ---------------------------------------------------
create table if not exists comments (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  request_id  bigint not null references requests(id) on delete cascade,
  user_id     uuid not null references profiles(id),
  text        text not null,
  created_at  timestamptz not null default now()
);

-- --- BUDGETS (filial oylik byudjeti) -------------------------------------------
create table if not exists budgets (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  branch_id   bigint not null references branches(id) on delete cascade,
  month       text not null,                     -- 'YYYY-MM'
  amount      numeric not null default 0,
  unique (branch_id, month)
);

-- --- ASSETS (aktivlar/jihozlar) ------------------------------------------------
create table if not exists assets (
  id              bigint generated always as identity primary key,
  org_id          uuid not null references organizations(id) on delete cascade,
  branch_id       bigint references branches(id),
  name            text not null,
  category        text,
  serial          text,
  purchase_date   date,
  warranty_until  date,
  note            text,
  created_at      timestamptz not null default now()
);

-- --- RECURRING_TASKS (profilaktik ishlar) --------------------------------------
create table if not exists recurring_tasks (
  id              bigint generated always as identity primary key,
  org_id          uuid not null references organizations(id) on delete cascade,
  title           text not null,
  description     text,
  branch_id       bigint references branches(id),
  category        text,
  interval_days   integer not null default 30,
  next_date       date not null,
  active          boolean not null default true,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

-- --- SUPPLIERS (yetkazib beruvchilar) ------------------------------------------
create table if not exists suppliers (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  phone       text,
  note        text,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- --- LIMITS (oylik limitlar) ---------------------------------------------------
create table if not exists limits (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  scope       text not null,                     -- 'category' | 'branch' | 'user' | 'role'
  ref         text not null,
  amount      numeric not null,
  created_at  timestamptz not null default now(),
  unique (org_id, scope, ref)
);

-- --- ROLE_PERMS (rol qobiliyatlari) --------------------------------------------
create table if not exists role_perms (
  org_id      uuid not null references organizations(id) on delete cascade,
  role        text not null,
  perm        text not null,
  allowed     boolean not null default true,
  unique (org_id, role, perm)
);

-- --- ORG_SETTINGS (korxona sozlamalari: ceo_threshold, axo_open_limit) ----------
create table if not exists org_settings (
  org_id      uuid not null references organizations(id) on delete cascade,
  key         text not null,
  value       text,
  unique (org_id, key)
);

-- Indekslar
create index if not exists idx_requests_org      on requests(org_id);
create index if not exists idx_requests_status   on requests(org_id, status);
create index if not exists idx_events_request    on events(request_id);
create index if not exists idx_notif_user        on notifications(user_id, is_read);
create index if not exists idx_comments_request  on comments(request_id);
create index if not exists idx_profiles_org      on profiles(org_id);
-- =============================================================================
-- RLS (Row Level Security) — multi-tenant izolyatsiya
-- Asosiy qoida: foydalanuvchi faqat O'Z org_id ostidagi qatorlarni ko'radi/o'zgartiradi.
-- Rol asosidagi nozik qoidalar (kim tasdiqlashi mumkin) server tomonda tekshiriladi.
-- =============================================================================

-- Joriy foydalanuvchining org_id sini qaytaruvchi yordamchi funksiya.
-- security definer — RLS ni chetlab profiles dan o'qiydi (rekursiyaning oldini oladi).
create or replace function auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- RLS ni yoqish
alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table branches        enable row level security;
alter table user_branches   enable row level security;
alter table requests        enable row level security;
alter table events          enable row level security;
alter table reports         enable row level security;
alter table report_items    enable row level security;
alter table notifications   enable row level security;
alter table comments        enable row level security;
alter table budgets         enable row level security;
alter table assets          enable row level security;
alter table recurring_tasks enable row level security;
alter table suppliers       enable row level security;
alter table limits          enable row level security;
alter table role_perms      enable row level security;
alter table org_settings    enable row level security;

-- --- ORGANIZATIONS: faqat o'z korxonasini ko'radi ------------------------------
create policy org_select on organizations
  for select using (id = auth_org_id());

-- --- PROFILES: o'z org ichidagilarni ko'radi; o'zini yangilaydi ----------------
create policy profiles_select on profiles
  for select using (org_id = auth_org_id() or id = auth.uid());
create policy profiles_insert on profiles
  for insert with check (id = auth.uid());
create policy profiles_update on profiles
  for update using (org_id = auth_org_id());

-- --- Umumiy org-scoped policy'lar (boshqa hamma jadval uchun bir xil shakl) -----
-- Har bir jadval: select/insert/update/delete faqat o'z org_id da.
do $$
declare t text;
begin
  foreach t in array array[
    'branches','user_branches','requests','events','reports','report_items',
    'notifications','comments','budgets','assets','recurring_tasks',
    'suppliers','limits','role_perms','org_settings'
  ]
  loop
    execute format($f$
      create policy %1$s_select on %1$s for select using (org_id = auth_org_id());
      create policy %1$s_insert on %1$s for insert with check (org_id = auth_org_id());
      create policy %1$s_update on %1$s for update using (org_id = auth_org_id());
      create policy %1$s_delete on %1$s for delete using (org_id = auth_org_id());
    $f$, t);
  end loop;
end $$;
-- =============================================================================
-- Yordamchi funksiyalar (RPC)
-- =============================================================================

-- Yangi foydalanuvchi ro'yxatdan o'tganda korxona ochadi va o'zi admin bo'ladi.
-- security definer — RLS ni chetlab birinchi org/profile yozadi.
create or replace function bootstrap_org(p_org_name text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_perm text;
begin
  if v_uid is null then
    raise exception 'Avtorizatsiya kerak';
  end if;

  -- Allaqachon korxonasi bormi?
  select org_id into v_org from profiles where id = v_uid;
  if v_org is not null then
    return v_org;
  end if;

  insert into organizations(name) values (p_org_name) returning id into v_org;

  insert into profiles(id, org_id, full_name, role)
    values (v_uid, v_org, coalesce(nullif(p_full_name, ''), 'Administrator'), 'admin')
  on conflict (id) do update set org_id = v_org, role = 'admin', full_name = excluded.full_name;

  -- Standart sozlamalar
  insert into org_settings(org_id, key, value) values
    (v_org, 'ceo_threshold', '50000000'),
    (v_org, 'axo_open_limit', '5')
  on conflict do nothing;

  -- Standart rol qobiliyatlari
  for v_role in select unnest(array[
    'admin','oper','branch_manager','regmen','axo','finance','ceo','ops_director','open_group','hr'
  ]) loop
    for v_perm in select unnest(array[
      'create_maintenance','create_new_branch','view_analytics','manage_limits','manage_settings'
    ]) loop
      insert into role_perms(org_id, role, perm, allowed)
      values (v_org, v_role, v_perm,
        case
          when v_perm='create_maintenance' and v_role in ('branch_manager','axo','regmen','open_group','admin') then true
          when v_perm='create_new_branch'  and v_role in ('open_group','admin') then true
          when v_perm='view_analytics'     and v_role in ('admin','oper','ceo','finance','ops_director','open_group','regmen') then true
          when v_perm='manage_limits'      and v_role in ('admin','oper','ceo','finance') then true
          when v_perm='manage_settings'    and v_role in ('admin','oper') then true
          else false
        end)
      on conflict do nothing;
    end loop;
  end loop;

  return v_org;
end $$;

-- Rolni tekshiruvchi (has_perm) — role_perms dan.
create or replace function has_perm(p_role text, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select allowed from role_perms where org_id = auth_org_id() and role = p_role and perm = p_perm),
    false
  )
$$;
-- =============================================================================
-- Storage — zayavka/hisobot rasmlari uchun 'photos' bucket
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Ko'rish: hamma o'qiy oladi (public bucket)
create policy "photos_public_read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Yuklash: faqat avtorizatsiyadan o'tganlar
create policy "photos_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

-- O'chirish: yuklagan foydalanuvchi
create policy "photos_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());
-- =============================================================================
-- Qayta dizayn — yangi maydonlar (2026-07)
-- Bu faylni Supabase SQL Editor'da bir marta ishga tushiring.
-- =============================================================================

-- Zayavka muhimligi: 'urgent' | 'normal' | 'low'
alter table requests add column if not exists priority text not null default 'normal';

-- Menejerga baho (yopilgach 1-5 yulduz)
alter table requests add column if not exists rating integer;

-- Kim bajardi: 'axo' | 'manager' (delegatsiya hisoboti uchun)
alter table requests add column if not exists executed_by text;

create index if not exists idx_requests_priority on requests(org_id, priority);
