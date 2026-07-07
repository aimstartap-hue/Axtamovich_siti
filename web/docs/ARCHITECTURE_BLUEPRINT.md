# ARCHITECTURE BLUEPRINT v1.2 — Financial Control Platform
**Status: RATIFIED (Konstitutsiya). Bundan buyon faqat ADR'lar orqali implementatsiya qarorlari.**

## §0. Maqom va Boshqaruv (Governance)
- Bu — eng yuqori hujjat. Qulaylik/tezlikdan ustun.
- **ADR (Architecture Decision Record)** Blueprintni izohlaydi va implementatsiyani belgilaydi, lekin unga **zid bo'lolmaydi**.
- Zid holat: avval **Blueprint Amendment**, keyin ADR.
- v1.2 dan keyin yangi falsafiy prinsip qo'shilmaydi. Rejim: "nima quramiz" → "qanday quramiz".
- Ochiq ADR'lar: **ADR-001 Tenancy** (izolyatsiya mexanizmi), **ADR-002 Evidence Capture** (offline/queue/sync/PWA usuli).

## §1. Platform Vision
Operatsiya yozuvchi ERP emas — har so'm ustidan **Control, Evidence, Accountability, Intelligence** ta'minlaydigan platforma. Farqlovchi qobiliyat: *"pul harakatlanishdan oldin qayerda xavf ostida ekanini ko'rsatish."*
**Yakuniy maqsad: Trust through Control** — CEO tizimga, investor raqamlarga, auditor tarixga, filial jarayonga ishonadi. Multi-company SaaS: O'zbekiston → xalqaro.

## §2. Core Principles (murosasiz)
1. Control > convenience.
2. SoD by design (engine bloklaydi).
3. Everything is an Event; holat voqealardan hosil qilinadi.
4. Evidence-bound; isbotsiz bir so'm ham qimirlamaydi.
5. Accountability; har voqeada aktor, vaqt, sabab.
6. Authorization = data (DoA), kod emas.
7. Workflow = configuration, kod emas.
8. Tenant Isolation is Absolute (mexanizm — ADR-001).
9. Fail-closed (deny by default).
10. Har modul Control/Evidence/Accountability/Intelligence/Recoverability'dan ≥1 ga xizmat qiladi.
11. **Human Override** — platforma hech qachon inson o'rniga moliyaviy qaror qilmaydi.
12. **Business Independence** — biznes qoidalari framework/texnologiyaga bog'lanmaydi; ular almashtiriladi, qoidalar o'zgarmaydi.
13. **Capture must never be lost** — evidence ulanish uzilsa ham yo'qolmaydi (mexanizm — ADR-002).

## §3. Domain Boundaries (bounded contexts)
Har kontekst o'z ma'lumotini egallaydi; boshqasining jadvaliga kirmaydi; aloqa faqat voqea + contract:
Identity & Tenancy · Org Structure · Authorization/DoA · Budget & Commitment · Procurement & Vendor · Requisition & Approval · Execution & Evidence · Goods Receipt & Inspection · Assets & Inventory · Treasury & Payment · Advance & Settlement · Ledger (Money) · Audit & Event Core (cross-cutting) · Control Intelligence · Notification.

## §3a. Business Capability Map
**Biznes capabilitylari:** Spend Management (jarayonlar: Open Group / AXO / kelajakda — konfiguratsiya) · Budgeting & Commitment · Procurement & Vendor · Goods Receipt & Inspection · Assets & Inventory · Treasury & Payment · Advance & Settlement · Accounting/Ledger · Control Intelligence.
**Platforma capabilitylari:** Audit & Event Core · Authorization/DoA · Workflow · Notification · File/Evidence · Identity & Tenancy.
Qoida: capability boshqasining jadval/ichki-logikaga tegmaydi — faqat contract + event. (Prinsip #7, #12 bilan uzviy.)

## §4. Core Engines
Audit & Event Core (umurtqa) · Authorization/DoA · Workflow · Notification · File/Evidence · Money (Ledger) · Control Intelligence.

## §5. System Layers (hexagonal)
Presentation (rol-asosli, deny-by-default) → Application (Command/Query) → Domain (Entity/Aggregate/invariant — sof) → Engines → Infrastructure. Domen framework/DB'dan mustaqil (Prinsip #12).

## §6. Event Philosophy
- **Command** — niyat; rad etilishi mumkin; saqlanmaydi.
- **Event** — sodir bo'lgan o'zgarmas fakt; append-only; haqiqat manbai.
- **Entity** — identifikatsiyali narsa; **Aggregate** — yagona ildizli izchillik chegarasi; Command → aggregat (invariant) → Event.
- **Compensation:** Event tahrirlanmaydi/o'chirilmaydi. Xato Compensation Event bilan tuzatiladi (PaymentReversed, ExpenseCorrected) — DoA'dan o'tgan, javobgar voqea. Money = ikki-yozuvli (storno bilan).
- **Backward Compatibility:** har event self-describing (type + version); yangi format = yangi versiya + upcasting; eski tarix hech qachon o'lmaydi.
- **Time (uch vaqt):** Business Time (real; nazorat nuqtasi, backdating tekshiriladi) · System Time (tizim qaror qilgan) · Recorded Time (buzilmas yozilgan). Har eventda alohida.
- Har state o'zgarishi Event; Approval/Comment/FileUpload/Payment — hammasi Event.

## §7. Data Flow (event-sourced + CQRS-lite)
Command → Application (DoA) → Aggregate (invariant) → Event append → Event Core → fan-out: State projections · Notification · Control rules · Ledger · AI. Query'lar read-model'ni o'qiydi.

## §8. Security Philosophy
Deny-by-default, least-privilege, fail-closed. SoD — engine majburlaydi. Audit — hash-zanjirli, append-only, tamper-evident (admin ham qayta yozolmaydi). Evidence: fayl xesh + vaqt/GPS + e-invoice. Baza kaliti — nazorat yo'li emas. Tizim-admin moliyaviy vakolatdan ajratilgan.

## §8a. Observability (Audit'dan alohida)
Ikki tekislik: **Audit plane** (biznes haqiqati, o'zgarmas, uzoq saqlash) va **Observability plane** (Performance, Errors, Queue, Integration/Sync health, Rule Engine — texnik, aylanadigan). Aralashmaydi; observability'ga maxfiy ma'lumot tushmaydi.

## §9. Integration Strategy
Ichda event-driven; tashqarida **API-first contract** (UI ham shu API mijozi, maxsus yo'q; tashqi ochilish xavfsizlik ostida). Tashqi: bank, soliq (e-invoice/QR), vendor portal, HR/payroll, BI — har biri anti-corruption layer ortida. Pul/tashqi operatsiyalarda idempotentlik.

## §10. AI / Control Intelligence Strategy
Event oqimining iste'molchisi. To'rt qobiliyat: **Detect → Explain → Recommend → Simulate** (What-if — commit qilmasdan replay). Hammasi Human Override (Prinsip #11) ostida; Explainability majburiy. Qatlamlar: deterministik → statistik → ML → LLM.

## Ilova — majburiy testlar
- **Modul mezonlari (5):** Control · Evidence · Accountability · Intelligence · Recoverability (texnik tiklanish + Compensation reversibility).
- **Savol:** "Bu modul bo'lmasa, kompaniya qaysi nazoratni yo'qotadi?"
- **Modul shabloni:** Business Goal → Users → Workflow → Security → Audit → Permissions → Control Value → Scalability → Risks.
- **Qurish tartibi:** Blueprint → Audit & Event Core → DoA → Workflow → Notification → File → Money → Control Intelligence.
