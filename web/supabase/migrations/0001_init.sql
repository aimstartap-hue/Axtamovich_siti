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
