# ADR-003 — Event Store Strategy: Selective Event Sourcing by Business Criticality

**Status:** Accepted
**Konstitutsiya:** Blueprint §6 (Event Philosophy), Prinsip #3, #15 (Business Criticality)
**Bog'liq:** BUSINESS_LIFECYCLE.md §3

## Context
Blueprint har state o'zgarishi Event chiqarishini talab qiladi (#3). Lekin hamma narsani to'liq Event-Sourced qilish (A-variant) — over-engineering va Prinsip #15 ga zid. B-variant (holat asosiy) — #3 ga qisman zid. Kerak: muvozanat.

## Decision
**Selektiv Event Sourcing — biznes-kritiklik asosida (texnik jamoa emas, biznes+audit belgilaydi):**

- **To'liq Event-Sourced (event = haqiqat, append-only, hash-zanjir, replay + compensation):**
  Commitment · Approval · Funding · Payment · Advance/Settlement · Goods Receipt/Inspection · Ledger.
  *Sabab:* pul harakatlanadi YOKI yuridik-audit majburiyat YOKI firibgarlik xavfi yuqori.

- **Audit-first CRUD (holat jadvali + baribir event chiqaradi):**
  reference/config (kategoriya, vendor profil), Notification, UI holati.
  *Sabab:* past xavf, sodda yechim yetarli.

## Consequences
- Kritik oqim uchun o'zgarmas, tamper-evident event log (bu — Audit & Event Core, 1-ustun).
- Holat jadvallari o'qish uchun qoladi (read-model), lekin kritik joyда event asosiy.
- Hozirgi koddan bosqichli migratsiya — big-bang rewrite yo'q.
- Kritik ro'yxat biznes+audit tomonidan ratifikatsiya qilinadi va o'zgarishi ADR bilan qayd etiladi.

## Open
- Kritik ro'yxatning yakuniy tasdig'i — biznes+audit bilan.
- Event kontrakti (tuzilishi, hash-zanjir, 3 vaqt, idempotency) — keyingi loyiha qadami.
