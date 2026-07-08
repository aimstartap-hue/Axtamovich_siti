# Deploy Readiness Review — saas-web → production (0007)

Sana: 2026-07-07. Auditor: Senior Architect. Branch: `saas-web` (`06f2ef3`+).
Production: `main` (`d43730e`) — **tegilmagan**.

## ❌ Blocker

1. **0007 migratsiya production bazasiga qo'llanMAGAN.**
   REST orqali 2 marta tekshirildi: `column requests.opening_stages does not exist` (42703).
   Merge qilinsa — `/openings` sahifasi va zayavkadagi "Ochilish boshqaruvi" kartasi
   (opening_stages/opening_project/opening_budget) **xato beradi (400)** va
   saveOpeningBudget/toggleStage amallari yiqiladi.
   → **Yechim:** avval `0007` ni Supabase'da ishga tushirish (foolproof usul + verify SELECT +
   screenshot), so'ng REST 200 tasdiq, so'ng merge.

## ⚠️ Xavflar (blocker emas)

1. **Katta partiya (49 funksiya) bir deployда.** Sizning qoidangiz: "bir vaqtda bir nechta
   katta o'zgarish chiqarma". Bu — open group (24) + CEO (25). *Yumshatish:* deploydan keyin
   to'liq production smoke-test (login, /openings, /ceo, /budgets, /analytics, zayavka detali).
2. **Valyuta fallback:** `exchange_rates` bo'sh bo'lsa, USD ochilishning "reja" summasi so'm deb
   ko'rsatiladi (kam baholanadi). *Yumshatish:* deploydan keyin /analytics'da "CBU'dan yangilash".
3. **[DEMO] ma'lumot production bazasida.** /openings, /analytics demo yozuvlarni ko'rsatadi.
   Kosmetik; verifikatsiyadan keyin tozalash mumkin.
4. **audit_log hali mutable** (Konstitutsiya §8 buzilishi). Funksional blocker emas; Event Core
   (0008) da hal qilinadi.
5. **rejectAction — terminal reject** (Task 2 topilmasi): CEO/admin yopilgan zayavkani ham rad
   eta oladi. Mavjud xatti-harakat; deploy blocker emas. Tavsiya: keyin `!isTerminal` bilan cheklash.
6. **login_parollar.xlsx git tarixida** (bitta commit, tepada olib tashlangan; private repo,
   yagona standart parol). Tavsiya: asosiy foydalanuvchilar parolini almashtirish.

## ✅ Tayyor

- Build yashil; **110 test** o'tadi; workflow 100% (lines), hash-chain 100%.
- Yangi runtime kod faqat `0007` ustunlariga (openings) bog'liq — u yagona blocker.
  CEO/budget/analytics 0006 (allaqachon qo'llangan) bilan ishlaydi.
- Event Core (contracts + hash) — **pure, ulanmagan** — deploy uchun xavfsiz.
- **Rollback aniq:** har commit mustaqil; merge — fast-forward. Muammo bo'lsa `main` dagi merge
  commitni revert → Vercel avvalgi holatga qaytaradi.

## Tavsiya (tartib bilan)

1. `0007` ni to'g'ri qo'llash (verify SELECT 3 qator + screenshot).
2. REST 200 tasdiq (men tekshiraman).
3. `saas-web` → `main` merge → deploy.
4. Production smoke-test (yuqoridagi sahifalar; xato/bo'sh joy bo'lsa — tuzatish, keyin davom).
5. Keyin: [DEMO] tozalash, parol almashtirish, so'ng Event Core (0008).
