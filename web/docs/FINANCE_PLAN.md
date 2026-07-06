# Moliya bloki — yaxshilanishlar rejasi (2026-07-06)

Foydalanuvchi tanlagan va izohlagan punktlar. **Belgilanmagan/izohlanmaganlar KERAK EMAS** (15, 22 — chiqarib tashlandi).

## Kiritilgan punktlar (23 ta)

### 🔴 Kritik
- [x] **1.** Byudjet oshsa moliya tasdiqida ogohlantirish/qoldiqni ko'rsatish ✅ Phase 1
- [x] **2.** `hard` limitni haqiqatan majburlash (oshsa bloklash) ✅ Phase 1
- [x] **3.** "Majburiyat (committed)" vs "sarflangan" farqi (tasdiqlangan, hali hisobot yo'q) ✅ Phase 1
- [ ] **4.** Valyuta normalizatsiyasi (USD→so'm) — **CBU API'дан avtomat** (Phase 2)
- [x] **5.** Limit `ref` dropdown (filial/user/rol tanlov, qo'lда yozish emas) ✅ Phase 1
- [x] **6.** Reja (estimated) vs Fakt (report total) — variance hisobot kartasida ✅ Phase 2
- [ ] **7.** Byudjetni kategoriya bo'yicha bo'lish — **filial + kategoriya** (Phase 2, 0006 migratsiya kerak)
- [x] **8.** Rollup ko'rinishlari: **umumiy (org) + filial + lavozim (rol)** — uchalasi ✅ Phase 1
- [x] **9.** Hisobot yaxlitligi: `reports.total` = Σ(qty×price) server tomonда kafolat ✅ (avvaldan)

### 🟡 Muhim
- [x] **10.** Kategoriya bo'yicha xarajat dashboardi (org kesim) ✅ Phase 2B (/analytics)
- [x] **11.** Supplier analitikasi (top ta'minotchilar, har biriga sarf) ✅ Phase 2B
- [x] **12.** Oylar kesimida trend grafigi ✅ Phase 2B
- [x] **13.** Byudjet ogohlantirishi: hisobotда filial byudjeti 80%/100% oshsa moliyaga bildirishnoma ✅ Phase 2C
- [x] **14.** Excel/CSV eksport (analitikada kategoriya/ta'minotchi) ✅ Phase 2B
- [ ] **16.** To'lov holati (paid vs approved), to'langan sana
- [ ] **17.** Byudjet nusxalash + **bir martaga yillik byudjet qo'yish**
- [x] **18.** CEO chegarasi: admin belgilaydi (avvaldan) + `manage_ceo_threshold` huquqi orqali moliyaga ham berish (analitikada tahrir) ✅ Phase 2C

### 🟢 Foydali
- [ ] **19.** Byudjet/limit o'zgarishlari auditi (kim, qachon, qancha)
- [ ] **20.** Yillik byudjet ko'rinishi + **Excel'дан avtomat import (tortish)**
- [x] **21.** Narx benchmark: bir xil mahsulot (kat+nom) oldingi narx bilan %-solishtiruv, faqat moliyaga, oldingi zayavkaga havola ✅ Phase 2
      Misol: pitsa pech filial 6 ga 2 000 000, 1 oydan keyin filial 7 ga 3 000 000.
      AXO hisobot topshirganда **faqat moliyaga** ko'rinsin + oldingi bog'liq zayavkaga
      havola (silka) bo'lsin, moliya bosib o'shani ham ko'ra olsin.
- [x] **23.** Filial "sarf tezligi" (burn rate) — oy oxiri prognozi byudjet sahifasida ✅ Phase 2C
- [x] **24.** Narx/summa maydonlariga mingliklar ajratkichi (`NumberInput`: hisobot + tasdiq oynasi + limit) ✅ Phase 1
- [x] **25.** Rad etilgan zayavkalar sabablari statistikasi ✅ Phase 2B (/analytics)

## Chiqarib tashlangan
- ~~15. Soliq alohida hisobi~~
- ~~22. Kutilayotgan tasdiqlar navbati~~

## Sxema o'zgarishlari (0006 migratsiya — rejalashtirilgan)
- `budgets`: `category text` qo'shish (7) + yillik uchun yondashuv (17/20)
- `requests` / `reports`: `paid boolean`, `paid_at` (16)
- yangi `exchange_rates` jadval (4) — *savol javobiga qarab*
- yangi `audit_log` yoki `budget_history` (19)
- `reports`: `flagged_for_finance boolean`, `related_request_id bigint` (21)
- `org_settings`: `ceo_threshold` allaqachon bor (18)

## Qarorlar (foydalanuvchi javob berdi 2026-07-06)
1. **Valyuta:** CBU API'дан avtomat tortiladi (cbu.uz)
2. **Punkt 21 (narx benchmark):** bir xil mahsulotni (kategoriya + nom) qayta olganда oldingi
   narx bilan solishtirish, **% o'zgarish** ko'rsatish (10% arzon = zo'r, 30% qimmat = moliya
   tekshiradi). Solishtirish kaliti: **kategoriya + mahsulot nomi + narx**. Faqat moliyaga ko'rinadi,
   oldingi bog'liq zayavkaga havola bo'ladi.
3. **Excel import:** foydalanuvchi **.xlsx fayl yuklaydi**, tizim o'qib to'ldiradi
4. **Kategoriya byudjeti:** **filial + kategoriya** darajasida

## Phase 1 — BAJARILDI (2026-07-06, saas-web)
Punktlar: 1, 2, 3, 5, 8, 9, 24. Sxema o'zgarishisiz. Build o'tdi. Production'ga chiqarilmagan.

## Phase 2 — keyingi (0006 migratsiya kerak)
6 (variance), 7 (kategoriya byudjet), 4 (CBU valyuta), 16 (paid), 17 (yillik/nusxa),
18 (admin chegara), 19 (audit), 20 (xlsx import), 21 (narx benchmark), 10,11,12,13,14,23,25.
