# Hash Chain Audit — events/hash.ts

Sana: 2026-07-07. Maqsad: `canonicalize()` va `verifyChain()` ning HOZIRGI
holatidagi zaifliklarini hujjatlashtirish. **Runtime kod o'zgartirilMADI** —
bular 0008 (Event Store) bosqichida hal qilinadi. Belgilangan `it.todo` testlari
`events/hash.test.ts` da turadi.

## verifyChain() — aniqlanMAYDIGAN buzilishlar

`verifyChain` hozir faqat (a) `prevHash` bog'lanishi va (b) har event `hash`ining
mazmuniga mosligini tekshiradi. Quyidagilar **aniqlanmaydi**:

1. **Sequence gap (1 → 2 → 4).** Agar prevHash zanjiri to'g'ri bo'lsa (masalan bir
   event umuman yozilmagan, lekin qolganlari qayta bog'langan), yo'qolган sequence
   sezilmaydi. → Tavsiya: monotonik `sequence === prev + 1` tekshiruvi.
2. **Duplicate sequence (2, 2).** Ikki event bir xil tartib raqami bilan — aniqlanmaydi.
3. **Duplicate event id.** Bir `id` ikki marta — aniqlanmaydi (idempotentlik buzilishi).

Bularning barchasi tamper yoki bug belgisi bo'lishi mumkin — Event Store `append`
bosqichida (yozishda) va `verifyChain` da (o'qishda) tekshirilishi kerak.

## canonicalize() — ma'lumot yo'qolishi xavflari

4. **Date → `{}`.** `canonicalize(new Date(...))` hozir `"{}"` qaytaradi (Date'da
   enumerable kalit yo'q). Natijada **har xil sanalar bir xil hash beradi** — jiddiy
   yaxlitlik xavfi. → Tavsiya: Date'ni ISO stringga o'girish. (Amalда envelope'даги
   vaqtlar allaqachon ISO string; xavf faqat payload ichida Date bo'lsa.)
5. **NaN / Infinity → `"null"`.** `JSON.stringify(NaN)` = `"null"`. Ya'ni noto'g'ri
   moliyaviy son jim `null` bo'lib hashlanadi — buzuq qiymat yashiriladi.
   → Tavsiya: cheksiz/NaN sonlarda `throw` (fail-closed, Blueprint #9).

## Yechim rejasi

Bularning hammasi **0008 — Audit & Event Core (runtime)** bosqichida hal qilinadi:
- `canonicalize`: Date → ISO, non-finite → throw.
- `verifyChain`: `sequence` monotonligi, `duplicate id/sequence` tekshiruvi (reason bilan).
- `EventStore.append`: yozishдан oldin bir xil validatsiya (preventive nazorat).

Hozir (deploy bloklangan, audit-only rejim) — faqat hujjat va `it.todo` testlar.
Runtime behavior o'zgarmagan.
