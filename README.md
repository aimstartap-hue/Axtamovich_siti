# AXO-OPEN group

Ko'p tarmoqli (filiallarga ega) bizneslar uchun **AXO boshqaruv tizimi**.
Filiallardan kelgan zayavkalar, tasdiqlash zanjiri, AXO bajarishi va foto-hisobotlarni bir joyda nazorat qiladi.

## Ishga tushirish

1. **`START.bat`** faylini ikki marta bosing — brauzer o'zi ochiladi.
2. Yoki qo'lda: papkada terminal ochib `python server.py` deb yozing va brauzerda `http://localhost:8000` ni oching.

> Hech narsa o'rnatish shart emas — faqat Python kerak (sizda 3.14 bor).

## Sinov uchun loginlar

| Login | Parol | Rol |
|-------|-------|-----|
| `admin` | `admin123` | Administrator |
| `oper` | `oper123` | Operator — filial qo'shish va barcha sozlamalar |
| `manager1` | `123` | Filial menejeri (Chilonzor) |
| `ceo1` | `123` | CEO |
| `finance1` | `123` | Moliya |
| `ops1` | `123` | Operatsion direktor |
| `axo1` | `123` | AXO xodimi |
| `open1` | `123` | Open group rahbari |

## Imkoniyatlar
- **Menyu (☰)** — barcha bo'limlar: Texnik zayavkalar, Yangi filial so'rovlari, Hisobot, Sozlamalar.
- **Dedline (muddat)** — tasdiqlashda sana belgilanadi; CEO belgilaydi, Moliya tasdiqlaydi yoki o'zgartirishni so'raydi.
- **Rasxod turlari** — har bir xarid kategoriya (Material, Jihoz, Transport va h.k.) bilan; hisobotda ko'rinadi.
- **Ko'rinish ajratish** — AXO faqat texnik zayavkalarni, Open group faqat yangi filial so'rovlarini ko'radi.
- **Bildirishnoma** — menyuda qizil belgi (sizdan harakat talab qilinadigan zayavkalar).
- **Telefonga moslashgan** interfeys.

## Ish jarayoni (workflow)

### 1) Texnik zayavka (filialdan)
1. **Filial menejeri** zayavka ochadi (sarlavha, izoh, rasm) — masalan "Pechim buzildi".
2. **Operatsion direktor / CEO / Moliya** dasturda tasdiqlaydi.
3. Tasdiqlangach → **AXO korzinkasiga** tushadi.
4. **AXO** bajaradi, foto-hisobot va narxlarni kiritadi.
5. **Mas'ul shaxs** hisobotni tasdiqlaydi → zayavka **yopiladi**.

### 2) Yangi filial so'rovi
1. **Open group rahbari** so'rov qoldiradi.
2. **CEO** tasdiqlaydi.
3. **Moliya** tasdiqlaydi → pul ajratiladi.
4. **Open group** foto-hisobot va xarajatlarni kiritadi → **yopiladi**.

## Texnik tafsilotlar
- Backend: Python standart kutubxonasi (`http.server`, `sqlite3`).
- Ma'lumotlar: `app.db` (SQLite) — avtomatik yaratiladi.
- Rasmlar: `uploads/` papkasida saqlanadi.
- Frontend: `static/` papkasida (HTML/CSS/JS).

## Parolni / foydalanuvchilarni o'zgartirish
Hozircha foydalanuvchilar `server.py` ichidagi seed ro'yxatdan yaratiladi.
Yangi foydalanuvchi qo'shish yoki rollarni o'zgartirish kerak bo'lsa — ayting, admin panelini qo'shib beraman.
