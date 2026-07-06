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
