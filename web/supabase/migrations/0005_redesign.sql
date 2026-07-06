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
