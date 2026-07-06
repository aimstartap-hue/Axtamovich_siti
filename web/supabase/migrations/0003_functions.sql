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
