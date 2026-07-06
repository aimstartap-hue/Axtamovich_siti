-- =============================================================================
-- Open group (yangi filial ochish) — qo'shimcha maydonlar (2026-07)
-- Bu faylni Supabase SQL Editor'da BIR MARTA ishga tushiring. Idempotent.
-- =============================================================================

-- Punkt 11: ochilish bosqichlari (checklist) — { "qurilish": true, ... }
alter table requests add column if not exists opening_stages jsonb;

-- Punkt 12: bir filial = bitta ochilish loyihasi (guruhlash uchun teg)
alter table requests add column if not exists opening_project text;

-- Punkt 1: ochilish kategoriya byudjeti (reja) — { "Первичная мебель": 20000000, ... }
alter table requests add column if not exists opening_budget jsonb;

create index if not exists idx_requests_opening_project on requests(org_id, opening_project);
