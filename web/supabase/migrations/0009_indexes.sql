-- =============================================================================
-- Performance indekslari (2026-07) — Priority 7.
-- Faqat og'ir querylar uchun HAQIQATAN foydali indekslar. Idempotent (if not exists).
-- Mavjud indekslar (schema/0002): idx_requests_org(org_id), idx_requests_priority
-- (org_id,priority), idx_requests_opening_project(org_id,opening_project) — takrorlanmaydi.
-- Postgres FK ustunlariga avtomat indeks yaratmaydi, shuning uchun join ustunlari kerak.
-- =============================================================================

-- reports: request detalida .eq(request_id); byudjet/CEO da created_at bo'yicha oylik agregatsiya
create index if not exists idx_reports_request on reports(request_id);
create index if not exists idx_reports_org_created on reports(org_id, created_at);

-- report_items: report_id join (benchmark/analytics), category bo'yicha limit/analytics
create index if not exists idx_report_items_report on report_items(report_id);
create index if not exists idx_report_items_org_category on report_items(org_id, category);

-- events: request detali timeline (.eq request_id); analytics/CEO da action bo'yicha
create index if not exists idx_events_request on events(request_id);
create index if not exists idx_events_org_action on events(org_id, action);

-- notifications: layout unread count va notifications sahifasi (.eq user_id .eq is_read)
create index if not exists idx_notifications_user_unread on notifications(user_id, is_read);

-- requests: ro'yxat/dashboard filtrlari (status, type, branch)
create index if not exists idx_requests_branch on requests(branch_id);
create index if not exists idx_requests_org_status on requests(org_id, status);
create index if not exists idx_requests_org_type on requests(org_id, type);

-- ESLATMA: budgets(branch_id, month) uchun alohida indeks QO'SHILMADI — 0006 dagi
-- unique(branch_id, month, category) constraint indeksi bu prefiksni qamraydi (dublikat bo'lardi).
