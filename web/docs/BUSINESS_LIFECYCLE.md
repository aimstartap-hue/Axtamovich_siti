# UNIVERSAL BUSINESS LIFECYCLE + CAPABILITY MAPPING
**Status: DRAFT (ratifikatsiya kutilmoqda). Business Ubiquitous Language — texnik terminlarsiz.**

Asosiy g'oya: kompaniya **event** boshqarmaydi — **Commitment (majburiyat)** boshqaradi. Har xarajat bitta universal hayot siklidan o'tadi. Event'lar — shu siklning o'zgarmas tarixi. Jarayonlar (Open Group, AXO, Procurement...) faqat **Workflow konfiguratsiyasi** bilan farqlanadi.

## 1. Universal Business Lifecycle (9 bosqich)

Har bosqich: maqsad · kim · asosiy qaror · nazorat · kirish→chiqish sharti.

1. **Need (Ehtiyoj)** — nima uchun pul kerak. *Kim:* tashabbuskor (Filial menejeri, Open Group, AXO). *Qaror:* ehtiyoj asosli va byudjetда bormi. *Nazorat:* byudjet mavjudligi, asos. *Chiqish:* rasmiy so'rov (Requisition).
2. **Commitment (Majburiyat)** — kompaniya sarflashga majburiyat oladi, **byudjet rezervlanadi** (hali to'lanmasa ham). *Qaror:* byudjet yetadimi. *Nazorat:* mavjud byudjetni kamaytiradi ("committed vs spent" shu yerdan). *Chiqish:* tasdiqqa tayyor majburiyat.
3. **Approval (Tasdiq)** — vakolatли shaxs(lar) DoA matritsasi bo'yicha tasdiqlaydi. *Nazorat:* SoD, summa×kategoriya×rol matritsasi, splitting bloki. *Chiqish:* tasdiqlangan majburiyat.
4. **Funding (Moliyalashtirish)** — Moliya pul ajratadi / avans beradi / limit qo'yadi. *Kim:* Moliya + Kazna (alohida). *Nazorat:* mablag' mavjudligi, treasury ajratilishi. *Chiqish:* ijroga ruxsat.
5. **Execution (Ijro)** — real xarid/ish. *Kim:* Open Group / AXO / pudratchi. *Nazorat:* limit ichida, tasdiqlangan doira bo'yicha. *Chiqish:* sarflandi.
6. **Evidence (Isbot)** — chek, foto, mahsulotlar (Capture must never be lost). *Nazorat:* isbot yaxlitligi, dublikat, narx benchmark, vaqt/GPS. *Chiqish:* isbotlangan xarajat.
7. **Inspection (Tekshiruv)** — mustaqil qabul/QC (ijrochidan boshqa). *Kim:* Omborchi + Inspektor. *Nazorat:* 3-way match, miqdor/sifat. *Chiqish:* tasdiqlangan qabul.
8. **Settlement (Hisob-kitob)** — reja vs fakt solishtiriladi, avans yopiladi (qoldiq qaytadi), to'lov alohida avtorizatsiya bilan. *Nazorat:* avans yopilgan, farq tasdiqlangan, to'lov ajratilgan. *Chiqish:* balanslangan.
9. **Closure (Yopilish)** — ledgerga yoziladi, aktivlar ro'yxatga, baho; o'zgarmas yozuv. *Nazorat:* barcha oldingi bosqich yakunlangan, hech narsa ochiq emas. *Chiqish:* yopilgan.

**Konfiguratsiya qoidasi:** har jarayon uchun bosqich **majburiy / ixtiyoriy / avto / o'tkazib yuboriladi** bo'lishi mumkin — bu Workflow Engine sozlamasi (Prinsip #7). Sikl bitta, xatti-harakat konfiguratsiya bilan.

## 2. Capability → Lifecycle Mapping

M=majburiy, I=ixtiyoriy, A=avto/soddalashtirilgan, —=o'tkaziladi.

| Jarayon | Need | Commit | Approve | Fund | Execute | Evidence | Inspect | Settle | Closure |
|---|---|---|---|---|---|---|---|---|---|
| Open Group (ochilish) | M | M | M | M | M | M | M | M | M |
| AXO (yirik ta'mir) | M | M | M | M | M | M | M | I | M |
| AXO (mayda ta'mir) | M | A | A | A | M | M | I | A | M |
| Procurement (xarid) | M | M | M | M | M | M | M | M | M |
| CapEx (kapital) | M | M | M | M | M | M | M | M | M |
| OpEx (joriy) | M | I | M | M | M | M | I | I | M |
| Advance (avans) | M | M | M | M | M | M | — | **M** | M |
| Service/Repair (xizmat) | M | I | M | I | M | M | I | I | M |

Xulosa: bitta sikl 8 xil jarayonni qamraydi — qayta foydalanish maksimal, dublikat yo'q.

## 3. Business Criticality (C-variant asosi)

Murakkablik biznes-xavfга qarab. Jarayon/majburiyat **kritik (→ to'liq Event Sourced)** hisoblanadi, agar:
- **pul harakatlanadi** (Funding, Payment, Advance, Ledger), YOKI
- **yuridik/audit majburiyat** yaratadi (Commitment, Approval, Settlement), YOKI
- **firibgarlik xavfi yuqori** (Execution+Evidence, Inspection/Goods Receipt).

**Past-kritik (sodda + audit-event):** reference/config (kategoriya, vendor profil maydonlari), Notification, UI holati.

**Draft kritik ro'yxat (biznes+audit ratifikatsiyasiga):** Commitment · Approval · Funding · Payment · Advance/Settlement · Goods Receipt/Inspection · Ledger. Bu ro'yxatni **texnik jamoa emas, biznes+audit** tasdiqlaydi (Business Criticality Principle).

## Konstitutsiyaga qo'shiladigan prinsiplar (v1.2 → amendment)
- **#14 Business Language** — asosiy obyektlar biznes tilida; texnik terminlar ichki implementatsiyada.
- **#15 Business Criticality** — arxitektura murakkabligi biznes xavfiga qarab, texnologiyaga emas.
