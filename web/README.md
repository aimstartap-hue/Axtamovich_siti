# AXO-OPEN group — SaaS versiya (Next.js + Supabase)

Ko'p tarmoqli (filiallarga ega) bizneslar uchun **AXO boshqaruv tizimi**.
Bu — eski Python versiyasining zamonaviy, bulutli (SaaS) ko'rinishi:

- **Next.js 16** (frontend + server) → **Vercel**da chiqadi
- **Supabase** (PostgreSQL + Auth + Storage) → baza va login
- **Ko'p korxona (multi-tenant)** — har firma faqat o'z ma'lumotini ko'radi (RLS)
- **Email bilan login**, mobilga mos (PWA), O'zbek interfeysi

---

## 📁 Tuzilma

```
web/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/        login, register
│  │  ├─ (app)/         dashboard, requests, budgets, assets, limits, admin…
│  │  └─ onboarding/
│  ├─ components/       Shell, PhotoUpload, StatusBadge…
│  ├─ lib/
│  │  ├─ constants.ts   rollar, statuslar, xarajat turlari, ruxsatlar
│  │  ├─ workflow.ts    TOZA workflow logikasi (serverdan mustaqil)
│  │  ├─ supabase/      client / server / admin
│  │  └─ auth.ts        joriy foydalanuvchi profili
│  └─ proxy.ts          auth qo'riqlash (Next.js 16 "proxy")
├─ supabase/
│  ├─ migrations/       0001..0004 (jadvallar, RLS, funksiyalar, storage)
│  └─ schema_full.sql   ⭐ hammasi bitta faylda (bir marta paste qilish uchun)
└─ scripts/
   └─ migrate_from_sqlite.py   eski app.db -> Supabase
```

---

## 🚀 O'rnatish (bosqichma-bosqich)

### 1. Supabase loyihasini ochish
1. https://supabase.com → **New project** (bepul tarif yetadi).
2. Loyiha ochilgach: **SQL Editor** → **New query**.
3. `supabase/schema_full.sql` faylining butun mazmunini nusxalab, editorga qo'ying va **Run** bosing.
   Bu barcha jadvallar, xavfsizlik (RLS) va funksiyalarni yaratadi.

### 2. Kalitlarni olish
Supabase → **Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (maxfiy!)

### 3. Loyihani sozlash
```powershell
cd web
copy .env.example .env.local   # keyin .env.local ichini to'ldiring
npm install
npm run dev
```
Brauzer: http://localhost:3000

### 4. Emailni tasdiqlashni o'chirish (ixtiyoriy, sinov uchun qulay)
Supabase → **Authentication → Providers → Email** → "Confirm email" ni o'chiring,
shunda ro'yxatdan o'tgan zahoti kirish mumkin bo'ladi.

---

## 📦 Eski ma'lumotni ko'chirish (app.db → Supabase)

Eski Python versiyadagi real ma'lumotni yangi bazaga ko'chiradi.

```powershell
cd web
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
python scripts/migrate_from_sqlite.py ../app.db
```

- Har bir eski xodimga sintetik email beriladi: `<username>@zahratun.local`
- Umumiy boshlang'ich parol: `Axo2026!` (keyin har kim almashtiradi)
- Masalan admin: `admin@zahratun.local` / `Axo2026!`

> Bu skript faqat Python standart kutubxonasidan foydalanadi — hech narsa o'rnatish shart emas.
> Faqat **bir marta**, bo'sh bazaga ishlatiladi.

---

## ☁️ Vercel'ga chiqarish

1. Kodni GitHub'ga yuklang.
2. https://vercel.com → **Add New → Project** → GitHub repozitoriyni tanlang.
3. **Root Directory** = `web` ni ko'rsating.
4. **Environment Variables** ga 3 ta kalitni qo'shing:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. **Deploy**. Bir necha daqiqada sayt tayyor + HTTPS.
6. Supabase → **Authentication → URL Configuration** da Vercel domenini qo'shing.

---

## 🔑 Rollar va workflow

**Rollar:** admin, oper, filial menejeri, regmen, axo, moliya, ceo, ops_director, open_group, hr.

**Texnik zayavka:** AXO → (katta summa bo'lsa CEO) → Moliya → AXO bajaradi → hisobot → yopiladi.
**Yangi filial:** Open group → CEO → Moliya → Open group bajaradi → hisobot → yopiladi.

Ish jarayoni mantiqi `src/lib/workflow.ts` da — u serverdan/bazadan **mustaqil**,
shuning uchun sinash va o'zgartirish oson.

---

## 🛠 Foydali buyruqlar
```powershell
npm run dev      # lokal ishga tushirish
npm run build    # production build (xatolarni tekshirish)
npx tsc --noEmit # faqat tiplarni tekshirish
```
