# -*- coding: utf-8 -*-
"""
AXO-OPEN group — ko'p tarmoqli bizneslar uchun AXO boshqaruv tizimi.
Faqat Python standart kutubxonasidan foydalanadi (o'rnatish shart emas).
Ishga tushirish:  python server.py
Brauzer:          http://localhost:8000
"""
import json
import os
import io
import csv
import sqlite3
import hashlib
import secrets
import base64
import mimetypes
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "app.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
PORT = 8000

SESSIONS = {}  # token -> user_id

# ---------------------------------------------------------------------------
# Rollar
# ---------------------------------------------------------------------------
ROLES = {
    "admin": "Administrator",
    "oper": "Operator (sozlamalar)",
    "branch_manager": "Filial menejeri",
    "regmen": "Regional menejer (Regmen)",
    "axo": "AXO xodimi",
    "finance": "Moliya",
    "ceo": "CEO",
    "ops_director": "Operatsion direktor",
    "open_group": "Open group rahbari",
    "hr": "HR (kadrlar)",
}

# Sozlamalar (filial/foydalanuvchi) huquqiga ega rollar
ADMIN_ROLES = ("admin", "oper")

# Rasxod (xarajat) turlari — bo'limlarga ajratilgan
EXPENSE_GROUPS = {
    "АХО / Хозяйственные": [
        "Вывоз мусора", "Аренда помещений", "IT обеспечение", "Электричество",
        "Покупка мелкого инвентаря", "Ремонт и ТО оборудования", "Ремонт помещения",
        "Интернет и связь", "Благотворительность", "Канцелярия", "Аудит",
        "Банковские комиссии", "Консультации", "Локальная логистика", "Мастер-классы",
        "Обслуживание ПО", "Питьевая вода", "Природный газ", "Пропан", "Ремонт авто",
        "Системы безопасности", "Хозрасходы", "Штрафы и пени", "Прочие админ расходы",
    ],
    "Капвложения / Оборудование": [
        "POS системы, кассы", "Автомобили", "Барное оборудование/кофе",
        "Вентиляция и кондиционирование (HVAC)", "Газовое оборудование и подводка",
        "Замена оборудования на более производительное", "Кухонное оборудование",
        "Мото/велотранспорт для доставки", "Производственное оборудование",
        "Холодильное оборудование", "Встроенная мебель", "Мебель зала", "Мебель кухни",
        "Офисная мебель", "Водоснабжение и канализация",
        "Инженерные системы на арендуемом объекте",
        "Капитальные улучшения арендуемого помещения", "Ремонт офиса",
        "Электрика (монтаж, щиты, линии)", "Лицензии длительного использования",
        "Новые системы безопасности", "Офисная техника", "Покупка ПО",
        "Права пользования (>1 года)", "Разработка собственных систем",
        "Серверы, IT-инфраструктура",
    ],
    "Открытие точки": [
        "Строительно-монтажные работы (открытие)", "Первичная мебель (открытие)",
        "Первичное оснащение оборудованием (открытие)",
        "IT-инфраструктура при открытии (открытие)", "Прочие расходы на открытие точки",
    ],
    "HR / Кадры": [
        "Авансы", "Аренда жилья", "Дорожные расходы", "Head hunter", "Welcome box",
        "Бонусы", "Командировки", "Консалтинг", "Корпоративы", "Матпомощь",
        "Мобильная связь", "Обучение", "Отпускные и больничные", "Питание", "Подарки",
        "Премии", "Реклама в соцсетях", "Рекрутинг", "Униформа", "Прочие HR расходы",
    ],
    "Маркетинг / PR": [
        "PR и спонсорство", "Агентские расходы", "Маркетинговые исследования",
        "Мероприятия", "Наружная реклама", "Планограмма", "Полиграфия",
        "Предоставление скидок (акции, комбо)", "Проведение BTL акций",
        "Программы лояльности", "Производство рекламных материалов", "Прочие PR",
        "Прочие рекламные расходы", "Радиореклама", "Развитие бренда",
        "Размещение на ТВ", "Реклама в интернете", "Сувениры", "Цифровая реклама",
    ],
    "Налоги": [
        "Налоговые штрафы", "Акцизы", "Налог на имущество", "Налог на прибыль",
        "НДС не к зачету", "Подоходный налог", "Прочие налоги", "Социальный налог",
        "Налог с оборота", "ИНПС", "Водный налог",
    ],
    "Финансовые": [
        "Возвраты займов", "Поступление кредитных средств",
        "Поступление финансовой помощи от собственника", "Прочие доходы",
        "Возврат выданных средств", "Выданные займы", "Дивиденды",
        "Погашение основного долга по кредиту", "Погашение процентов по кредиту",
        "Прочие фин расходы",
    ],
}

# Qaysi zayavka turida qaysi bo'limlar ko'rinadi
TYPE_GROUPS = {
    "maintenance": ["АХО / Хозяйственные", "Капвложения / Оборудование"],   # AXO
    "new_branch": ["Открытие точки", "Капвложения / Оборудование"],         # Open group
}

# Tekis ro'yxat (orqaga moslik uchun)
EXPENSE_CATEGORIES = [c for cats in EXPENSE_GROUPS.values() for c in cats]

# Status nomlari (UI uchun)
STATUS_LABELS = {
    "pending_axo": "AXO tasdig'i kutilmoqda",
    "pending_approval": "Tasdiq kutilmoqda",
    "pending_ceo": "CEO tasdig'i kutilmoqda",
    "pending_finance": "Moliya tasdig'i kutilmoqda",
    "deadline_dispute": "CEO sanani ko'rib chiqmoqda",
    "approved": "Tasdiqlandi (AXO korzinkasida)",
    "report_submitted": "Hisobot topshirildi",
    "closed": "Yopildi",
    "rejected": "Rad etildi",
    "hr_review": "HR ko'rib chiqmoqda (oylikdan kesish)",
    "funded": "Moliyalashtirildi (ish jarayonida)",
}


# ---------------------------------------------------------------------------
# Ma'lumotlar bazasi
# ---------------------------------------------------------------------------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return h, salt


def init_db():
    conn = db()
    c = conn.cursor()
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'active'   -- 'construction' | 'active'
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL,
            full_name TEXT NOT NULL,
            branch_id INTEGER REFERENCES branches(id)
        );
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,             -- 'maintenance' | 'new_branch'
            title TEXT NOT NULL,
            description TEXT,
            photo TEXT,
            branch_id INTEGER REFERENCES branches(id),
            created_by INTEGER NOT NULL REFERENCES users(id),
            status TEXT NOT NULL,
            deadline TEXT,
            deadline_confirmed INTEGER DEFAULT 0,
            rejected_by INTEGER,
            suggested_deadline TEXT,
            deadline_disputed INTEGER DEFAULT 0,
            limit_amount REAL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL REFERENCES requests(id),
            user_id INTEGER REFERENCES users(id),
            action TEXT NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL REFERENCES requests(id),
            note TEXT,
            total REAL DEFAULT 0,
            photos_json TEXT,
            submitted_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS report_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL REFERENCES reports(id),
            name TEXT NOT NULL,
            category TEXT,
            qty REAL DEFAULT 1,
            price REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            request_id INTEGER REFERENCES requests(id),
            text TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL REFERENCES requests(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            text TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL REFERENCES branches(id),
            month TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            UNIQUE(branch_id, month)
        );
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER REFERENCES branches(id),
            name TEXT NOT NULL,
            category TEXT,
            serial TEXT,
            purchase_date TEXT,
            warranty_until TEXT,
            note TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recurring_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            branch_id INTEGER REFERENCES branches(id),
            category TEXT,
            interval_days INTEGER NOT NULL DEFAULT 30,
            next_date TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            phone TEXT,
            note TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    conn.commit()

    # Migratsiya (eski bazaga yangi ustunlar)
    def add_col(table, col, decl):
        try:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
        except sqlite3.OperationalError:
            pass
    add_col("requests", "deadline", "TEXT")
    add_col("requests", "deadline_confirmed", "INTEGER DEFAULT 0")
    add_col("requests", "rejected_by", "INTEGER")
    add_col("requests", "suggested_deadline", "TEXT")
    add_col("requests", "deadline_disputed", "INTEGER DEFAULT 0")
    add_col("requests", "limit_amount", "REAL")
    add_col("requests", "estimated_amount", "REAL")
    add_col("requests", "estimated_currency", "TEXT DEFAULT 'so''m'")
    add_col("requests", "escalated", "INTEGER DEFAULT 0")
    add_col("report_items", "category", "TEXT")
    add_col("report_items", "supplier", "TEXT")
    add_col("branches", "status", "TEXT DEFAULT 'active'")
    conn.commit()

    # Seed (faqat bo'sh bo'lsa)
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        branches = [("Chilonzor", "active"), ("Yunusobod", "active"),
                    ("Sergeli", "active"), ("Sergeli-2 (qurilishda)", "construction")]
        for name, st in branches:
            c.execute("INSERT INTO branches(name,status) VALUES(?,?)", (name, st))
        conn.commit()
        chilonzor = c.execute(
            "SELECT id FROM branches WHERE name='Chilonzor'"
        ).fetchone()[0]

        seed_users = [
            ("admin", "admin123", "admin", "Administrator", None),
            ("oper", "oper123", "oper", "Operator (sozlamalar)", None),
            ("manager1", "123", "branch_manager", "Aziz (Chilonzor menejeri)", chilonzor),
            ("regmen1", "123", "regmen", "Kamol (Regional menejer)", None),
            ("axo1", "123", "axo", "Bekzod (AXO)", None),
            ("finance1", "123", "finance", "Dilnoza (Moliya)", None),
            ("ceo1", "123", "ceo", "Jamshid (CEO)", None),
            ("ops1", "123", "ops_director", "Sardor (Operatsion direktor)", None),
            ("open1", "123", "open_group", "Otabek (Open group rahbari)", None),
            ("hr1", "123", "hr", "Nodira (HR)", None),
        ]
        for username, pw, role, name, br in seed_users:
            ph, salt = hash_password(pw)
            c.execute(
                "INSERT INTO users(username,password_hash,salt,role,full_name,branch_id) VALUES(?,?,?,?,?,?)",
                (username, ph, salt, role, name, br),
            )
        conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Workflow logikasi
# ---------------------------------------------------------------------------
def start_status(rtype):
    """Zayavka boshlang'ich statusi. Texnik -> avval AXO, yangi filial -> CEO."""
    return "pending_axo" if rtype == "maintenance" else "pending_ceo"


def can_approve(request, role):
    """Berilgan rol shu statusdagi zayavkani tasdiqlay oladimi?"""
    t, s = request["type"], request["status"]
    if t == "maintenance":
        if s == "pending_axo":               # avval AXO ko'rib tasdiqlaydi
            return role == "axo"
        if s == "pending_ceo":               # CEO tasdiqlaydi + muddat qo'yadi
            return role == "ceo"
        if s == "pending_finance":           # Moliya tasdiqlaydi + limit qo'yadi
            return role == "finance"
        if s == "report_submitted":          # yopilishini tasdiqlaydi
            return role in ("ceo", "finance")
    elif t == "new_branch":
        if s == "pending_ceo":
            return role == "ceo"
        if s == "pending_finance":
            return role == "finance"
        if s == "report_submitted":
            return role in ("ceo", "finance")
    return False


def sets_deadline_on_approve(request):
    """Shu tasdiqda muddat (sana) belgilanadimi? — CEO bosqichida."""
    return request["status"] == "pending_ceo"


def sets_limit_on_approve(request):
    """Shu tasdiqda Moliya AXO uchun limit qo'yadimi?"""
    return request["type"] == "maintenance" and request["status"] == "pending_finance"


def sets_estimate_on_approve(request):
    """Shu tasdiqda AXO taxminiy summa (narx) kiritadimi? — AXO bosqichida."""
    return request["type"] == "maintenance" and request["status"] == "pending_axo"


def can_request_deadline_change(request, role):
    """Moliya muddatni o'zgartirishni so'ray oladimi? (faqat bir marta, CEO ga qaytadi)"""
    return (request["status"] == "pending_finance" and role == "finance"
            and not request["deadline_disputed"])


def can_resolve_dispute(request, role):
    """CEO muddat nizosini hal qiladi (shu sanani tasdiqlash yoki boshqa sana)."""
    return request["status"] == "deadline_dispute" and role == "ceo"


def next_status_on_approve(request):
    t, s = request["type"], request["status"]
    if t == "maintenance":
        if s == "pending_axo":
            return "pending_ceo"
        if s == "pending_ceo":
            return "pending_finance"
        if s == "pending_finance":
            return "approved"            # AXO korzinkasiga tushadi
        if s == "report_submitted":
            return "closed"
    elif t == "new_branch":
        if s == "pending_ceo":
            return "pending_finance"
        if s == "pending_finance":
            return "funded"
        if s == "report_submitted":
            return "closed"
    return s


def can_submit_report(request, role):
    t, s = request["type"], request["status"]
    # AXO faqat Moliya muddatni tasdiqlagandan keyin (status='approved') hisobot topshira oladi
    if t == "maintenance" and s == "approved" and role == "axo":
        return True
    if t == "new_branch" and s == "funded" and role == "open_group":
        return True
    return False


def can_reopen(request, user):
    """Rad etilgan zayavkaga qayta imkon berish (rad etgan shaxs yoki CEO/admin)."""
    if request["status"] != "rejected":
        return False
    return user["role"] in ("ceo", "admin") or request["rejected_by"] == user["id"]


def can_send_to_hr(request, user):
    """Rad etilganni HR ga yo'naltirish (oylikdan kesish)."""
    if request["status"] != "rejected":
        return False
    return user["role"] in ("ceo", "admin") or request["rejected_by"] == user["id"]


def can_hr_resolve(request, role):
    """HR masalani yopadi."""
    return request["status"] == "hr_review" and role in ("hr", "admin")


def needs_action(request, role):
    """Shu rol uchun bu zayavka hozir harakat (tasdiq yoki hisobot) talab qiladimi?"""
    if can_approve(request, role) or can_submit_report(request, role):
        return True
    if can_resolve_dispute(request, role):     # CEO muddat nizosini hal qilishi kerak
        return True
    if role == "hr" and request["status"] == "hr_review":
        return True
    return False


# Status -> shu bosqichda harakat qilishi kerak bo'lgan rollar (bildirishnoma uchun)
NOTIFY_ROLES = {
    "pending_axo": ["axo"],
    "pending_ceo": ["ceo"],
    "pending_finance": ["finance"],
    "approved": ["axo"],
    "report_submitted": ["ceo", "finance"],
    "deadline_dispute": ["ceo"],
    "funded": ["open_group"],
    "hr_review": ["hr"],
}


def add_notification(conn, user_id, request_id, text):
    conn.execute(
        "INSERT INTO notifications(user_id,request_id,text,is_read,created_at) VALUES(?,?,?,0,?)",
        (user_id, request_id, text, now()),
    )


def process_due(conn):
    """Har bir zayavkalar so'rovida ishlaydi: profilaktik ishlardan zayavka yaratadi
    va muddati o'tgan zayavkalarni eskalatsiya qiladi. Idempotent."""
    today = datetime.now().strftime("%Y-%m-%d")
    # 1) Profilaktik (takrorlanuvchi) ishlar
    due = conn.execute(
        "SELECT * FROM recurring_tasks WHERE active=1 AND next_date<=?", (today,)
    ).fetchall()
    for rt in due:
        cur = conn.execute(
            "INSERT INTO requests(type,title,description,photo,branch_id,created_by,status,created_at) "
            "VALUES('maintenance',?,?,?,?,?,?,?)",
            (f"[Profilaktika] {rt['title']}", rt["description"] or "", None, rt["branch_id"],
             rt["created_by"], "pending_axo", now()),
        )
        rid = cur.lastrowid
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, rt["created_by"], "Profilaktik ish avtomatik yaratildi", rt["title"], now()),
        )
        notify_change(conn, rid, "pending_axo", None, rt["created_by"], f"Profilaktik ish: {rt['title']}")
        # keyingi sanani surish
        try:
            base = datetime.strptime(rt["next_date"], "%Y-%m-%d")
        except ValueError:
            base = datetime.now()
        nxt = base + timedelta(days=int(rt["interval_days"] or 30))
        # o'tib ketgan bo'lsa bugundan keyingi sanaga
        while nxt.strftime("%Y-%m-%d") <= today:
            nxt += timedelta(days=int(rt["interval_days"] or 30))
        conn.execute("UPDATE recurring_tasks SET next_date=? WHERE id=?", (nxt.strftime("%Y-%m-%d"), rt["id"]))

    # 2) Muddati o'tgan zayavkalar eskalatsiyasi (bir marta)
    overdue = conn.execute(
        "SELECT * FROM requests WHERE deadline IS NOT NULL AND deadline<? "
        "AND status NOT IN ('closed','rejected') AND COALESCE(escalated,0)=0", (today,)
    ).fetchall()
    for r in overdue:
        conn.execute("UPDATE requests SET escalated=1 WHERE id=?", (r["id"],))
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (r["id"], None, "⚠️ Muddat o'tdi — eskalatsiya", f"Muddat: {r['deadline']}", now()),
        )
        # CEO + joriy mas'ul rol + egasiga xabar
        recipients = set()
        for u in conn.execute("SELECT id FROM users WHERE role='ceo'").fetchall():
            recipients.add(u["id"])
        for role in NOTIFY_ROLES.get(r["status"], []):
            for u in conn.execute("SELECT id FROM users WHERE role=?", (role,)).fetchall():
                recipients.add(u["id"])
        if r["created_by"]:
            recipients.add(r["created_by"])
        for uid in recipients:
            add_notification(conn, uid, r["id"], f"⚠️ #{r['id']}: muddat o'tib ketdi ({r['deadline']}) — {r['title']}")
    conn.commit()


def notify_change(conn, rid, new_status, actor_id, creator_id, action_text):
    """Status o'zgargach: keyingi mas'ul rollarga + zayavka egasiga bildirishnoma."""
    recipients = set()
    for role in NOTIFY_ROLES.get(new_status, []):
        for u in conn.execute("SELECT id FROM users WHERE role=?", (role,)).fetchall():
            recipients.add(u["id"])
    if creator_id:
        recipients.add(creator_id)
    recipients.discard(actor_id)
    text = f"#{rid}: {action_text}"
    for uid in recipients:
        add_notification(conn, uid, rid, text)


def can_view(request, user):
    """Foydalanuvchi shu zayavkani ko'ra oladimi?"""
    role = user["role"]
    # Filial menejeri faqat o'z filiali zayavkalarini ko'radi
    if role == "branch_manager":
        return request["branch_id"] == user["branch_id"] or request["created_by"] == user["id"]
    # Regional menejer — barcha filiallarning texnik zayavkalari
    if role == "regmen":
        return request["type"] == "maintenance"
    # AXO faqat texnik zayavkalarni ko'radi (Open group ma'lumotlari ko'rinmaydi)
    if role == "axo":
        return request["type"] == "maintenance"
    # Open group faqat yangi filial so'rovlarini ko'radi (AXO ma'lumotlari ko'rinmaydi)
    if role == "open_group":
        return request["type"] == "new_branch"
    # HR faqat o'ziga yo'naltirilganlarni ko'radi
    if role == "hr":
        return request["status"] == "hr_review"
    # Operator faqat sozlamalar bilan ishlaydi
    if role == "oper":
        return False
    # admin, ceo, finance, ops_director — hammasini ko'radi
    return True


# ---------------------------------------------------------------------------
# Yordamchilar
# ---------------------------------------------------------------------------
def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def save_data_url(data_url):
    """base64 data URL -> faylga saqlaydi, nisbiy yo'lni qaytaradi."""
    if not data_url or "," not in data_url:
        return None
    header, b64 = data_url.split(",", 1)
    ext = ".jpg"
    if "image/png" in header:
        ext = ".png"
    elif "image/webp" in header:
        ext = ".webp"
    elif "image/gif" in header:
        ext = ".gif"
    fname = secrets.token_hex(12) + ext
    path = os.path.join(UPLOAD_DIR, fname)
    try:
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
    except Exception:
        return None
    return "/uploads/" + fname


def user_by_token(token):
    uid = SESSIONS.get(token)
    if not uid:
        return None
    conn = db()
    u = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return u


def request_to_dict(conn, r, full=False):
    creator = conn.execute("SELECT full_name, role FROM users WHERE id=?", (r["created_by"],)).fetchone()
    branch = None
    if r["branch_id"]:
        b = conn.execute("SELECT name FROM branches WHERE id=?", (r["branch_id"],)).fetchone()
        branch = b["name"] if b else None
    d = {
        "id": r["id"],
        "type": r["type"],
        "title": r["title"],
        "description": r["description"],
        "photo": r["photo"],
        "branch": branch,
        "created_by": creator["full_name"] if creator else "?",
        "created_by_role": ROLES.get(creator["role"], "") if creator else "",
        "status": r["status"],
        "status_label": STATUS_LABELS.get(r["status"], r["status"]),
        "deadline": r["deadline"],
        "deadline_confirmed": bool(r["deadline_confirmed"]),
        "suggested_deadline": r["suggested_deadline"],
        "limit_amount": r["limit_amount"],
        "estimated_amount": r["estimated_amount"],
        "estimated_currency": r["estimated_currency"] or "so'm",
        "overdue": bool(r["deadline"] and r["status"] not in ("closed", "rejected")
                        and r["deadline"] < datetime.now().strftime("%Y-%m-%d")),
        "escalated": bool(r["escalated"]),
        "created_at": r["created_at"],
    }
    if full:
        events = conn.execute(
            "SELECT e.*, u.full_name, u.role FROM events e LEFT JOIN users u ON u.id=e.user_id "
            "WHERE request_id=? ORDER BY e.id", (r["id"],)
        ).fetchall()
        d["events"] = [
            {
                "action": e["action"],
                "comment": e["comment"],
                "user": e["full_name"] or "Tizim",
                "role": ROLES.get(e["role"], ""),
                "at": e["created_at"],
            }
            for e in events
        ]
        reports = conn.execute("SELECT * FROM reports WHERE request_id=? ORDER BY id", (r["id"],)).fetchall()
        d["reports"] = []
        for rep in reports:
            items = conn.execute("SELECT * FROM report_items WHERE report_id=?", (rep["id"],)).fetchall()
            submitter = conn.execute("SELECT full_name FROM users WHERE id=?", (rep["submitted_by"],)).fetchone()
            d["reports"].append({
                "note": rep["note"],
                "total": rep["total"],
                "photos": json.loads(rep["photos_json"] or "[]"),
                "by": submitter["full_name"] if submitter else "?",
                "at": rep["created_at"],
                "items": [{"name": i["name"], "category": i["category"] or "", "supplier": i["supplier"] or "", "qty": i["qty"], "price": i["price"]} for i in items],
            })
        comments = conn.execute(
            "SELECT c.*, u.full_name, u.role FROM comments c LEFT JOIN users u ON u.id=c.user_id "
            "WHERE request_id=? ORDER BY c.id", (r["id"],)
        ).fetchall()
        d["comments"] = [
            {"text": c["text"], "user": c["full_name"] or "?", "role": ROLES.get(c["role"], ""), "at": c["created_at"]}
            for c in comments
        ]
    return d


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    # --- yordamchilar ---
    def get_token(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        if "session" in cookie:
            return cookie["session"].value
        return None

    def current_user(self):
        return user_by_token(self.get_token())

    def send_json(self, data, status=200, set_cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_csv(self, filename, rows):
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerows(rows)
        body = ("﻿" + buf.getvalue()).encode("utf-8")  # BOM -> Excel kirillni to'g'ri ochadi
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def serve_file(self, path, content_type=None):
        if not os.path.isfile(path):
            self.send_error(404)
            return
        if content_type is None:
            content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        # Keshni o'chirish — har doim eng yangi HTML/CSS/JS yuklanadi (uploads bundan mustasno)
        if "/uploads/" not in path.replace("\\", "/"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        self.end_headers()
        self.wfile.write(data)

    # --- GET ---
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/" or path == "/index.html":
            return self.serve_file(os.path.join(STATIC_DIR, "index.html"), "text/html; charset=utf-8")
        if path == "/manifest.json":
            return self.serve_file(os.path.join(STATIC_DIR, "manifest.json"), "application/manifest+json; charset=utf-8")
        if path == "/sw.js":
            # Service worker ildiz scope'da bo'lishi kerak (butun saytni boshqaradi)
            return self.serve_file(os.path.join(STATIC_DIR, "sw.js"), "application/javascript; charset=utf-8")
        if path.startswith("/static/"):
            return self.serve_file(os.path.join(STATIC_DIR, os.path.basename(path)))
        if path.startswith("/uploads/"):
            return self.serve_file(os.path.join(UPLOAD_DIR, os.path.basename(path)))
        if path.startswith("/api/"):
            return self.handle_api_get(path)
        self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api_post(parsed.path)
        self.send_error(404)

    # --- API GET ---
    def handle_api_get(self, path):
        user = self.current_user()
        if path == "/api/me":
            if not user:
                return self.send_json({"user": None})
            return self.send_json({"user": self.user_dict(user)})

        if not user:
            return self.send_json({"error": "Avtorizatsiya kerak"}, 401)

        if path == "/api/meta":
            conn = db()
            sups = [s["name"] for s in conn.execute("SELECT name FROM suppliers ORDER BY name").fetchall()]
            conn.close()
            return self.send_json({
                "categories": EXPENSE_CATEGORIES,
                "groups": EXPENSE_GROUPS,
                "type_groups": TYPE_GROUPS,
                "suppliers": sups,
            })

        if path == "/api/export/requests.csv":
            conn = db()
            reqs = [r for r in conn.execute("SELECT * FROM requests ORDER BY id").fetchall() if can_view(r, user)]
            rows = [["#", "Tur", "Sarlavha", "Filial", "Yaratdi", "Holat", "Muddat", "AXO limiti", "Yaratilgan"]]
            for r in reqs:
                br = conn.execute("SELECT name FROM branches WHERE id=?", (r["branch_id"],)).fetchone() if r["branch_id"] else None
                cr = conn.execute("SELECT full_name FROM users WHERE id=?", (r["created_by"],)).fetchone()
                rows.append([r["id"], "Yangi filial" if r["type"] == "new_branch" else "Texnik",
                             r["title"], br["name"] if br else "", cr["full_name"] if cr else "",
                             STATUS_LABELS.get(r["status"], r["status"]), r["deadline"] or "",
                             r["limit_amount"] or "", r["created_at"]])
            conn.close()
            return self.send_csv("zayavkalar.csv", rows)

        if path == "/api/export/expenses.csv":
            conn = db()
            visible = {r["id"] for r in conn.execute("SELECT * FROM requests").fetchall() if can_view(r, user)}
            data = conn.execute(
                "SELECT ri.*, rp.request_id, rp.created_at AS rdate, req.title, req.branch_id "
                "FROM report_items ri JOIN reports rp ON rp.id=ri.report_id "
                "JOIN requests req ON req.id=rp.request_id ORDER BY rp.request_id"
            ).fetchall()
            rows = [["Sana", "Zayavka#", "Filial", "Rasxod turi", "Nomi", "Soni", "Narxi", "Jami"]]
            for d in data:
                if d["request_id"] not in visible:
                    continue
                br = conn.execute("SELECT name FROM branches WHERE id=?", (d["branch_id"],)).fetchone() if d["branch_id"] else None
                rows.append([d["rdate"], d["request_id"], br["name"] if br else "", d["category"] or "",
                             d["name"], d["qty"], d["price"], (d["qty"] or 0) * (d["price"] or 0)])
            conn.close()
            return self.send_csv("xarajatlar.csv", rows)

        if path == "/api/budgets":
            from urllib.parse import parse_qs
            qs = parse_qs(urlparse(self.path).query)
            month = (qs.get("month", [None])[0]) or datetime.now().strftime("%Y-%m")
            conn = db()
            branches = conn.execute("SELECT * FROM branches ORDER BY status DESC, name").fetchall()
            allowed = user["branch_id"] if user["role"] == "branch_manager" else None
            out = []
            for b in branches:
                if allowed is not None and b["id"] != allowed:
                    continue
                bud = conn.execute("SELECT amount FROM budgets WHERE branch_id=? AND month=?", (b["id"], month)).fetchone()
                spent = conn.execute(
                    "SELECT COALESCE(SUM(rp.total),0) AS s FROM reports rp JOIN requests req ON req.id=rp.request_id "
                    "WHERE req.branch_id=? AND substr(rp.created_at,1,7)=?", (b["id"], month)
                ).fetchone()["s"] or 0
                amount = bud["amount"] if bud else 0
                out.append({"branch_id": b["id"], "name": b["name"], "status": b["status"],
                            "budget": amount, "spent": spent, "remaining": amount - spent})
            conn.close()
            return self.send_json({
                "month": month, "branches": out,
                "can_edit": user["role"] in ("finance", "admin", "oper"),
            })

        if path == "/api/recurring":
            conn = db()
            process_due(conn)
            rows = conn.execute("SELECT * FROM recurring_tasks ORDER BY active DESC, next_date").fetchall()
            out = []
            for rt in rows:
                br = conn.execute("SELECT name FROM branches WHERE id=?", (rt["branch_id"],)).fetchone() if rt["branch_id"] else None
                out.append({"id": rt["id"], "title": rt["title"], "description": rt["description"] or "",
                            "branch": br["name"] if br else "", "branch_id": rt["branch_id"],
                            "category": rt["category"] or "", "interval_days": rt["interval_days"],
                            "next_date": rt["next_date"], "active": bool(rt["active"])})
            conn.close()
            return self.send_json({"tasks": out, "can_edit": user["role"] in ("admin", "oper", "axo", "ceo")})

        if path == "/api/suppliers":
            conn = db()
            rows = conn.execute("SELECT * FROM suppliers ORDER BY name").fetchall()
            out = []
            for s in rows:
                # narx tarixi: shu yetkazib beruvchidan olingan tovarlar
                hist = conn.execute(
                    "SELECT ri.name, ri.price, ri.qty, rp.created_at FROM report_items ri "
                    "JOIN reports rp ON rp.id=ri.report_id WHERE ri.supplier=? ORDER BY rp.created_at DESC LIMIT 30",
                    (s["name"],)
                ).fetchall()
                total = conn.execute(
                    "SELECT COALESCE(SUM(qty*price),0) AS t FROM report_items WHERE supplier=?", (s["name"],)
                ).fetchone()["t"] or 0
                out.append({"id": s["id"], "name": s["name"], "phone": s["phone"] or "", "note": s["note"] or "",
                            "total": total,
                            "history": [{"name": h["name"], "price": h["price"], "qty": h["qty"], "at": h["created_at"]} for h in hist]})
            conn.close()
            return self.send_json({"suppliers": out, "can_edit": user["role"] in ("admin", "oper", "axo")})

        if path == "/api/assets":
            conn = db()
            allowed = user["branch_id"] if user["role"] == "branch_manager" else None
            rows = conn.execute("SELECT * FROM assets ORDER BY id DESC").fetchall()
            out = []
            for a in rows:
                if allowed is not None and a["branch_id"] != allowed:
                    continue
                br = conn.execute("SELECT name FROM branches WHERE id=?", (a["branch_id"],)).fetchone() if a["branch_id"] else None
                out.append({"id": a["id"], "name": a["name"], "category": a["category"] or "",
                            "branch": br["name"] if br else "", "serial": a["serial"] or "",
                            "purchase_date": a["purchase_date"] or "", "warranty_until": a["warranty_until"] or "",
                            "note": a["note"] or ""})
            conn.close()
            return self.send_json({"assets": out, "can_edit": user["role"] in ("admin", "oper", "axo")})

        if path == "/api/kpi":
            conn = db()
            all_reqs = conn.execute("SELECT * FROM requests").fetchall()
            reqs = [r for r in all_reqs if can_view(r, user)]
            closed = [r for r in reqs if r["status"] == "closed"]

            def last_event_time(rid):
                e = conn.execute("SELECT MAX(created_at) AS m FROM events WHERE request_id=?", (rid,)).fetchone()
                return e["m"] if e else None

            def parse(dt):
                try:
                    return datetime.strptime(dt, "%Y-%m-%d %H:%M")
                except (TypeError, ValueError):
                    return None

            # O'rtacha hal qilish vaqti (kunlarda) + muddatida bajarilgan %
            durations, on_time, with_deadline = [], 0, 0
            for r in closed:
                ct, closed_t = parse(r["created_at"]), parse(last_event_time(r["id"]))
                if ct and closed_t:
                    durations.append((closed_t - ct).total_seconds() / 86400.0)
                if r["deadline"]:
                    with_deadline += 1
                    if closed_t and closed_t.strftime("%Y-%m-%d") <= r["deadline"]:
                        on_time += 1
            avg_days = round(sum(durations) / len(durations), 1) if durations else 0
            on_time_pct = round(on_time / with_deadline * 100) if with_deadline else 0

            # Oylik trend (so'nggi 6 oy)
            months = {}
            for r in reqs:
                m = (r["created_at"] or "")[:7]
                if m:
                    months[m] = months.get(m, 0) + 1
            trend = sorted(months.items())[-6:]

            # Eng faol AXO/Open group (hisobot soni bo'yicha)
            visible_ids = {r["id"] for r in reqs}
            performers = {}
            for rep in conn.execute("SELECT rp.request_id, rp.submitted_by, u.full_name FROM reports rp LEFT JOIN users u ON u.id=rp.submitted_by").fetchall():
                if rep["request_id"] in visible_ids and rep["full_name"]:
                    performers[rep["full_name"]] = performers.get(rep["full_name"], 0) + 1
            top_performers = sorted(performers.items(), key=lambda x: -x[1])[:5]

            # Eng ko'p xarajat filiallari
            branch_spend = {}
            for rep in conn.execute("SELECT rp.total, req.branch_id FROM reports rp JOIN requests req ON req.id=rp.request_id").fetchall():
                if rep["branch_id"]:
                    branch_spend[rep["branch_id"]] = branch_spend.get(rep["branch_id"], 0) + (rep["total"] or 0)
            top_branches = []
            for bid, sp in sorted(branch_spend.items(), key=lambda x: -x[1])[:5]:
                b = conn.execute("SELECT name FROM branches WHERE id=?", (bid,)).fetchone()
                top_branches.append({"name": b["name"] if b else "?", "spend": sp})

            overdue_now = sum(1 for r in reqs if r["deadline"] and r["status"] not in ("closed", "rejected")
                              and r["deadline"] < datetime.now().strftime("%Y-%m-%d"))
            conn.close()
            return self.send_json({
                "avg_days": avg_days, "on_time_pct": on_time_pct, "closed_count": len(closed),
                "overdue_now": overdue_now, "with_deadline": with_deadline,
                "trend": [{"month": m, "count": c} for m, c in trend],
                "top_performers": [{"name": n, "count": c} for n, c in top_performers],
                "top_branches": top_branches,
            })

        if path == "/api/notifications":
            conn = db()
            rows = conn.execute(
                "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40", (user["id"],)
            ).fetchall()
            unread = conn.execute(
                "SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0", (user["id"],)
            ).fetchone()[0]
            conn.close()
            return self.send_json({
                "unread": unread,
                "items": [{"id": n["id"], "request_id": n["request_id"], "text": n["text"],
                           "is_read": bool(n["is_read"]), "at": n["created_at"]} for n in rows],
            })

        conn = db()
        if path == "/api/branches":
            rows = conn.execute("SELECT * FROM branches ORDER BY status DESC, name").fetchall()
            conn.close()
            return self.send_json([{"id": r["id"], "name": r["name"], "status": r["status"]} for r in rows])

        if path == "/api/requests":
            process_due(conn)   # profilaktika + eskalatsiya
            rows = conn.execute("SELECT * FROM requests ORDER BY id DESC").fetchall()
            out = []
            for r in rows:
                if not can_view(r, user):
                    continue
                d = request_to_dict(conn, r)
                d["needs_my_action"] = needs_action(r, user["role"])
                out.append(d)
            conn.close()
            return self.send_json(out)

        if path == "/api/users":
            if user["role"] not in ADMIN_ROLES:
                conn.close()
                return self.send_json({"error": "Ruxsat yo'q"}, 403)
            rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
            out = []
            for u in rows:
                bn = None
                if u["branch_id"]:
                    b = conn.execute("SELECT name FROM branches WHERE id=?", (u["branch_id"],)).fetchone()
                    bn = b["name"] if b else None
                out.append({
                    "id": u["id"], "username": u["username"], "full_name": u["full_name"],
                    "role": u["role"], "role_label": ROLES.get(u["role"], u["role"]), "branch": bn,
                })
            conn.close()
            return self.send_json({"users": out, "roles": ROLES})

        if path == "/api/stats":
            # Faqat foydalanuvchi ko'ra oladigan zayavkalar bo'yicha
            all_reqs = conn.execute("SELECT * FROM requests").fetchall()
            reqs = [r for r in all_reqs if can_view(r, user)]
            visible_ids = {r["id"] for r in reqs}
            status_counts, type_counts = {}, {"maintenance": 0, "new_branch": 0}
            for r in reqs:
                status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1
                type_counts[r["type"]] = type_counts.get(r["type"], 0) + 1

            # Hisobotlar (faqat ko'rinadigan zayavkalar uchun)
            reports = conn.execute(
                "SELECT rp.*, req.branch_id FROM reports rp JOIN requests req ON req.id=rp.request_id"
            ).fetchall()
            branch_spend, branch_cnt = {}, {}
            total_spend = 0.0
            for rep in reports:
                if rep["request_id"] not in visible_ids:
                    continue
                bid = rep["branch_id"]
                branch_spend[bid] = branch_spend.get(bid, 0) + (rep["total"] or 0)
                total_spend += rep["total"] or 0
            for r in reqs:
                branch_cnt[r["branch_id"]] = branch_cnt.get(r["branch_id"], 0) + 1

            branches = conn.execute("SELECT * FROM branches").fetchall()
            allowed_branch = user["branch_id"] if user["role"] == "branch_manager" else None
            branch_stats = []
            for b in branches:
                if allowed_branch is not None and b["id"] != allowed_branch:
                    continue
                branch_stats.append({
                    "name": b["name"], "status": b["status"],
                    "spend": branch_spend.get(b["id"], 0), "requests": branch_cnt.get(b["id"], 0),
                })

            # Rasxod turi bo'yicha (ko'rinadigan hisobotlar)
            rep_ids = tuple(rep["id"] for rep in reports if rep["request_id"] in visible_ids) or (-1,)
            qmarks = ",".join("?" * len(rep_ids))
            cat_rows = conn.execute(
                f"SELECT COALESCE(NULLIF(category,''),'Boshqa') AS cat, SUM(qty*price) AS s "
                f"FROM report_items WHERE report_id IN ({qmarks}) GROUP BY cat ORDER BY s DESC", rep_ids
            ).fetchall()
            categories = [{"name": cr["cat"], "spend": cr["s"] or 0} for cr in cat_rows]
            conn.close()
            return self.send_json({
                "total": len(reqs),
                "active": sum(v for k, v in status_counts.items() if k not in ("closed", "rejected")),
                "closed": status_counts.get("closed", 0),
                "rejected": status_counts.get("rejected", 0),
                "total_spend": total_spend,
                "status_counts": status_counts,
                "type_counts": type_counts,
                "branches": sorted(branch_stats, key=lambda x: -x["spend"]),
                "categories": categories,
                "status_labels": STATUS_LABELS,
            })

        if path.startswith("/api/requests/"):
            rid = int(path.rsplit("/", 1)[-1])
            r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
            if not r:
                conn.close()
                return self.send_json({"error": "Topilmadi"}, 404)
            if not can_view(r, user):
                conn.close()
                return self.send_json({"error": "Bu ma'lumotni ko'rish huquqingiz yo'q"}, 403)
            d = request_to_dict(conn, r, full=True)
            d["can_approve"] = can_approve(r, user["role"])
            d["can_submit_report"] = can_submit_report(r, user["role"])
            d["can_request_deadline_change"] = can_request_deadline_change(r, user["role"])
            d["sets_deadline"] = sets_deadline_on_approve(r)
            d["sets_limit"] = sets_limit_on_approve(r)
            d["sets_estimate"] = sets_estimate_on_approve(r)
            d["can_resolve_dispute"] = can_resolve_dispute(r, user["role"])
            d["can_reopen"] = can_reopen(r, user)
            d["can_send_to_hr"] = can_send_to_hr(r, user)
            d["can_hr_resolve"] = can_hr_resolve(r, user["role"])
            conn.close()
            return self.send_json(d)

        conn.close()
        self.send_json({"error": "Noma'lum endpoint"}, 404)

    # --- API POST ---
    def handle_api_post(self, path):
        if path == "/api/login":
            data = self.read_json()
            conn = db()
            u = conn.execute("SELECT * FROM users WHERE username=?", (data.get("username", ""),)).fetchone()
            conn.close()
            if not u:
                return self.send_json({"error": "Login yoki parol xato"}, 401)
            ph, _ = hash_password(data.get("password", ""), u["salt"])
            if ph != u["password_hash"]:
                return self.send_json({"error": "Login yoki parol xato"}, 401)
            token = secrets.token_hex(24)
            SESSIONS[token] = u["id"]
            cookie = f"session={token}; Path=/; HttpOnly; SameSite=Lax"
            return self.send_json({"user": self.user_dict(u)}, set_cookie=cookie)

        if path == "/api/logout":
            token = self.get_token()
            SESSIONS.pop(token, None)
            return self.send_json({"ok": True}, set_cookie="session=; Path=/; Max-Age=0")

        user = self.current_user()
        if not user:
            return self.send_json({"error": "Avtorizatsiya kerak"}, 401)

        if path == "/api/requests":
            return self.create_request(user)

        if path == "/api/notifications/read":
            conn = db()
            conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (user["id"],))
            conn.commit()
            conn.close()
            return self.send_json({"ok": True})

        if path == "/api/change-password":
            data = self.read_json()
            old = data.get("old") or ""
            new = data.get("new") or ""
            if len(new) < 3:
                return self.send_json({"error": "Yangi parol kamida 3 belgi bo'lsin"}, 400)
            oh, _ = hash_password(old, user["salt"])
            if oh != user["password_hash"]:
                return self.send_json({"error": "Joriy parol xato"}, 400)
            nh, salt = hash_password(new)
            conn = db()
            conn.execute("UPDATE users SET password_hash=?, salt=? WHERE id=?", (nh, salt, user["id"]))
            conn.commit()
            conn.close()
            return self.send_json({"ok": True})

        if path == "/api/budgets":
            if user["role"] not in ("finance", "admin", "oper"):
                return self.send_json({"error": "Faqat Moliya/Admin byudjet belgilaydi"}, 403)
            data = self.read_json()
            try:
                bid = int(data.get("branch_id"))
                amount = float(data.get("amount"))
            except (TypeError, ValueError):
                return self.send_json({"error": "Noto'g'ri ma'lumot"}, 400)
            month = (data.get("month") or "").strip() or datetime.now().strftime("%Y-%m")
            conn = db()
            conn.execute(
                "INSERT INTO budgets(branch_id,month,amount) VALUES(?,?,?) "
                "ON CONFLICT(branch_id,month) DO UPDATE SET amount=excluded.amount",
                (bid, month, amount),
            )
            conn.commit()
            conn.close()
            return self.send_json({"ok": True})

        if path == "/api/assets" or (path.startswith("/api/assets/") and path.endswith("/delete")):
            return self.handle_assets_post(user, path)

        if path == "/api/recurring" or (path.startswith("/api/recurring/") and path.endswith("/delete")):
            return self.handle_recurring_post(user, path)

        if path == "/api/suppliers" or (path.startswith("/api/suppliers/") and path.endswith("/delete")):
            return self.handle_suppliers_post(user, path)

        # --- Admin/Operator amallari ---
        if path in ("/api/users", "/api/branches") or path.startswith("/api/users/") or path.startswith("/api/branches/"):
            # Qurilishni tugatib filialni faollashtirishni CEO ham tasdiqlay oladi
            if path.endswith("/activate"):
                if user["role"] not in ADMIN_ROLES and user["role"] != "ceo":
                    return self.send_json({"error": "Ruxsat yo'q"}, 403)
            elif user["role"] not in ADMIN_ROLES:
                return self.send_json({"error": "Ruxsat yo'q"}, 403)
            return self.handle_admin(path)

        if path.endswith("/approve"):
            return self.approve_request(user, path)
        if path.endswith("/reject"):
            return self.reject_request(user, path)
        if path.endswith("/deadline-change"):
            return self.deadline_change(user, path)
        if path.endswith("/resolve-dispute"):
            return self.resolve_dispute(user, path)
        if path.endswith("/reopen"):
            return self.reopen_request(user, path)
        if path.endswith("/to-hr"):
            return self.send_to_hr(user, path)
        if path.endswith("/hr-resolve"):
            return self.hr_resolve(user, path)
        if path.endswith("/comment"):
            return self.add_comment(user, path)
        if path.endswith("/report"):
            return self.submit_report(user, path)

        self.send_json({"error": "Noma'lum endpoint"}, 404)

    # --- amallar ---
    def create_request(self, user):
        data = self.read_json()
        rtype = data.get("type", "maintenance")
        title = (data.get("title") or "").strip()
        if not title:
            return self.send_json({"error": "Sarlavha kiritilmadi"}, 400)

        if rtype == "maintenance":
            if user["role"] not in ("branch_manager", "admin"):
                return self.send_json({"error": "Bu turdagi zayavkani faqat filial menejeri ochadi"}, 403)
            status = start_status("maintenance")   # pending_axo
            branch_id = user["branch_id"] or data.get("branch_id")
        elif rtype == "new_branch":
            if user["role"] not in ("open_group", "admin"):
                return self.send_json({"error": "Bu turdagi so'rovni faqat Open group rahbari ochadi"}, 403)
            status = start_status("new_branch")    # pending_ceo
            branch_id = data.get("branch_id")
        else:
            return self.send_json({"error": "Noto'g'ri tur"}, 400)

        photo = save_data_url(data.get("photo"))
        conn = db()
        cur = conn.execute(
            "INSERT INTO requests(type,title,description,photo,branch_id,created_by,status,created_at) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (rtype, title, data.get("description", ""), photo, branch_id, user["id"], status, now()),
        )
        rid = cur.lastrowid
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "Zayavka ochildi", title, now()),
        )
        notify_change(conn, rid, status, user["id"], user["id"], f"Yangi zayavka — {title}")
        conn.commit()
        conn.close()
        return self.send_json({"id": rid, "ok": True})

    def approve_request(self, user, path):
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_approve(r, user["role"]):
            conn.close()
            return self.send_json({"error": "Sizda bu bosqichni tasdiqlash huquqi yo'q"}, 403)
        new_status = next_status_on_approve(r)
        comment = data.get("comment", "")

        # Muddat (deadline) belgilash — CEO bosqichida
        if sets_deadline_on_approve(r):
            deadline = (data.get("deadline") or "").strip() or None
            conn.execute(
                "UPDATE requests SET status=?, deadline=?, deadline_confirmed=0 WHERE id=?",
                (new_status, deadline, rid),
            )
            if deadline:
                comment = (comment + f"  📅 Muddat: {deadline}").strip()
        elif r["status"] == "pending_finance":
            # Moliya tasdiqlaydi: muddatni tasdiqlaydi + (texnik bo'lsa) AXO uchun limit qo'yadi
            limit = data.get("limit")
            try:
                limit = float(limit) if limit not in (None, "") else None
            except (TypeError, ValueError):
                limit = None
            conn.execute(
                "UPDATE requests SET status=?, deadline_confirmed=1, limit_amount=? WHERE id=?",
                (new_status, limit, rid),
            )
            if r["deadline"]:
                comment = (comment + f"  ✅ Muddat tasdiqlandi: {r['deadline']}").strip()
            if limit:
                comment = (comment + f"  💰 AXO limiti: {limit:,.0f} so'm").strip()
        elif sets_estimate_on_approve(r):
            # AXO tasdiqlaydi + taxminiy summa (narx) kiritadi
            est = data.get("estimated")
            try:
                est = float(est) if est not in (None, "") else None
            except (TypeError, ValueError):
                est = None
            cur = (data.get("currency") or "so'm").strip() or "so'm"
            conn.execute("UPDATE requests SET status=?, estimated_amount=?, estimated_currency=? WHERE id=?",
                         (new_status, est, cur, rid))
            if est:
                comment = (comment + f"  💵 Taxminiy summa: {est:,.0f} {cur}").strip()
        else:
            conn.execute("UPDATE requests SET status=? WHERE id=?", (new_status, rid))

        label = "Yopilishi tasdiqlandi" if new_status == "closed" else "Tasdiqladi"
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], label, comment, now()),
        )
        act = "Yopildi" if new_status == "closed" else f"{user['full_name']} tasdiqladi → {STATUS_LABELS.get(new_status, new_status)}"
        notify_change(conn, rid, new_status, user["id"], r["created_by"], act)
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": new_status})

    def deadline_change(self, user, path):
        """Moliya CEO ga muddatni o'zgartirish so'rovini yuboradi -> CEO ga qaytadi."""
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_request_deadline_change(r, user["role"]):
            conn.close()
            return self.send_json({"error": "Muddat o'zgartirishni so'ray olmaysiz (allaqachon so'ralgan)"}, 403)
        reason = (data.get("comment") or "").strip()
        suggested = (data.get("suggested_deadline") or "").strip() or None
        note = reason + (f"  (Taklif qilingan sana: {suggested})" if suggested else "")
        # CEO ga nizo sifatida qaytadi; bir marta so'raladi
        conn.execute(
            "UPDATE requests SET status='deadline_dispute', deadline_confirmed=0, "
            "suggested_deadline=?, deadline_disputed=1 WHERE id=?", (suggested, rid)
        )
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "Sanani o'zgartirishni so'radi (CEO ga)", note, now()),
        )
        notify_change(conn, rid, "deadline_dispute", user["id"], r["created_by"], "Moliya boshqa sana so'radi — CEO hal qilsin")
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": "deadline_dispute"})

    def resolve_dispute(self, user, path):
        """CEO muddat nizosini hal qiladi: shu sanani tasdiqlaydi yoki boshqa sana yuboradi.
        Har holatda Moliya bosqichiga qaytadi (qayta sana so'ralmaydi)."""
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_resolve_dispute(r, user["role"]):
            conn.close()
            return self.send_json({"error": "Sizda huquq yo'q"}, 403)
        # Yangi sana berilsa o'shani, aks holda Moliya taklif qilgan sanani oladi
        new_deadline = (data.get("deadline") or "").strip() or r["suggested_deadline"] or r["deadline"]
        conn.execute(
            "UPDATE requests SET status='pending_finance', deadline=?, deadline_confirmed=0, "
            "suggested_deadline=NULL WHERE id=?", (new_deadline, rid)
        )
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "Muddatni yakunladi", f"📅 Yangi muddat: {new_deadline}", now()),
        )
        notify_change(conn, rid, "pending_finance", user["id"], r["created_by"], f"CEO muddatni belgiladi: {new_deadline}")
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": "pending_finance"})

    def reject_request(self, user, path):
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_approve(r, user["role"]):
            conn.close()
            return self.send_json({"error": "Sizda huquq yo'q"}, 403)
        conn.execute("UPDATE requests SET status='rejected', rejected_by=? WHERE id=?", (user["id"], rid))
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "Rad etdi", data.get("comment", ""), now()),
        )
        if r["created_by"] != user["id"]:
            add_notification(conn, r["created_by"], rid, f"#{rid}: {user['full_name']} rad etdi")
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": "rejected"})

    def reopen_request(self, user, path):
        """Rad etilgan zayavkaga qayta imkon berish -> boshlang'ich bosqichga qaytadi."""
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_reopen(r, user):
            conn.close()
            return self.send_json({"error": "Sizda huquq yo'q"}, 403)
        back = start_status(r["type"])
        conn.execute("UPDATE requests SET status=?, rejected_by=NULL WHERE id=?", (back, rid))
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "Qayta imkon berdi", data.get("comment", ""), now()),
        )
        notify_change(conn, rid, back, user["id"], r["created_by"], "Qayta imkon berildi")
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": back})

    def send_to_hr(self, user, path):
        """Rad etilganni HR ga yo'naltirish (oylikdan kesish)."""
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_send_to_hr(r, user):
            conn.close()
            return self.send_json({"error": "Sizda huquq yo'q"}, 403)
        note = (data.get("comment") or "Oylikdan kesilsin").strip()
        conn.execute("UPDATE requests SET status='hr_review' WHERE id=?", (rid,))
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "HR ga yo'naltirdi (oylikdan kesish)", note, now()),
        )
        notify_change(conn, rid, "hr_review", user["id"], r["created_by"], "HR ga yo'naltirildi (oylikdan kesish)")
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": "hr_review"})

    def hr_resolve(self, user, path):
        """HR masalani yopadi."""
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_hr_resolve(r, user["role"]):
            conn.close()
            return self.send_json({"error": "Sizda huquq yo'q"}, 403)
        conn.execute("UPDATE requests SET status='closed' WHERE id=?", (rid,))
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "HR hal qildi (yopildi)", data.get("comment", ""), now()),
        )
        conn.commit()
        conn.close()
        return self.send_json({"ok": True, "status": "closed"})

    def submit_report(self, user, path):
        rid = int(path.split("/")[3])
        data = self.read_json()
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_submit_report(r, user["role"]):
            conn.close()
            return self.send_json({"error": "Hozir hisobot topshira olmaysiz"}, 403)

        items = data.get("items", [])
        total = 0.0
        for it in items:
            try:
                total += float(it.get("qty", 1)) * float(it.get("price", 0))
            except Exception:
                pass

        photos = []
        for p in data.get("photos", []):
            saved = save_data_url(p)
            if saved:
                photos.append(saved)

        cur = conn.execute(
            "INSERT INTO reports(request_id,note,total,photos_json,submitted_by,created_at) VALUES(?,?,?,?,?,?)",
            (rid, data.get("note", ""), total, json.dumps(photos), user["id"], now()),
        )
        report_id = cur.lastrowid
        for it in items:
            name = (it.get("name") or "").strip()
            if not name:
                continue
            conn.execute(
                "INSERT INTO report_items(report_id,name,category,supplier,qty,price) VALUES(?,?,?,?,?,?)",
                (report_id, name, (it.get("category") or "").strip(), (it.get("supplier") or "").strip(),
                 float(it.get("qty", 1) or 1), float(it.get("price", 0) or 0)),
            )
        conn.execute("UPDATE requests SET status='report_submitted' WHERE id=?", (rid,))
        notify_change(conn, rid, "report_submitted", user["id"], r["created_by"], f"Foto-hisobot topshirildi (jami {total:,.0f} so'm) — tasdiqlang")
        conn.execute(
            "INSERT INTO events(request_id,user_id,action,comment,created_at) VALUES(?,?,?,?,?)",
            (rid, user["id"], "Foto-hisobot topshirdi", f"Jami: {total:,.0f}", now()),
        )
        conn.commit()
        conn.close()
        return self.send_json({"ok": True})

    def add_comment(self, user, path):
        """Zayavkaga izoh (chat). Ko'ra oladigan har kim yoza oladi."""
        rid = int(path.split("/")[3])
        data = self.read_json()
        text = (data.get("text") or "").strip()
        if not text:
            return self.send_json({"error": "Izoh bo'sh"}, 400)
        conn = db()
        r = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
        if not r:
            conn.close()
            return self.send_json({"error": "Topilmadi"}, 404)
        if not can_view(r, user):
            conn.close()
            return self.send_json({"error": "Huquq yo'q"}, 403)
        conn.execute(
            "INSERT INTO comments(request_id,user_id,text,created_at) VALUES(?,?,?,?)",
            (rid, user["id"], text, now()),
        )
        # Ishtirokchilarga (egasi + ilgari harakat qilganlar) bildirishnoma
        parts = set()
        if r["created_by"]:
            parts.add(r["created_by"])
        for e in conn.execute("SELECT DISTINCT user_id FROM events WHERE request_id=?", (rid,)).fetchall():
            if e["user_id"]:
                parts.add(e["user_id"])
        for e in conn.execute("SELECT DISTINCT user_id FROM comments WHERE request_id=?", (rid,)).fetchall():
            if e["user_id"]:
                parts.add(e["user_id"])
        parts.discard(user["id"])
        for uid in parts:
            add_notification(conn, uid, rid, f"#{rid}: yangi izoh — {user['full_name']}")
        conn.commit()
        conn.close()
        return self.send_json({"ok": True})

    def handle_recurring_post(self, user, path):
        if user["role"] not in ("admin", "oper", "axo", "ceo"):
            return self.send_json({"error": "Ruxsat yo'q"}, 403)
        conn = db()
        try:
            if path.endswith("/delete"):
                tid = int(path.split("/")[3])
                conn.execute("DELETE FROM recurring_tasks WHERE id=?", (tid,))
                conn.commit()
                return self.send_json({"ok": True})
            data = self.read_json()
            title = (data.get("title") or "").strip()
            if not title:
                return self.send_json({"error": "Sarlavha kiritilmadi"}, 400)
            try:
                interval = int(data.get("interval_days") or 30)
            except (TypeError, ValueError):
                interval = 30
            next_date = (data.get("next_date") or "").strip() or datetime.now().strftime("%Y-%m-%d")
            bid = data.get("branch_id")
            try:
                bid = int(bid)
            except (TypeError, ValueError):
                bid = None
            conn.execute(
                "INSERT INTO recurring_tasks(title,description,branch_id,category,interval_days,next_date,active,created_by,created_at) "
                "VALUES(?,?,?,?,?,?,1,?,?)",
                (title, (data.get("description") or "").strip(), bid, (data.get("category") or "").strip(),
                 interval, next_date, user["id"], now()),
            )
            conn.commit()
            return self.send_json({"ok": True})
        finally:
            conn.close()

    def handle_suppliers_post(self, user, path):
        if user["role"] not in ("admin", "oper", "axo"):
            return self.send_json({"error": "Ruxsat yo'q"}, 403)
        conn = db()
        try:
            if path.endswith("/delete"):
                sid = int(path.split("/")[3])
                conn.execute("DELETE FROM suppliers WHERE id=?", (sid,))
                conn.commit()
                return self.send_json({"ok": True})
            data = self.read_json()
            name = (data.get("name") or "").strip()
            if not name:
                return self.send_json({"error": "Nom kiritilmadi"}, 400)
            if conn.execute("SELECT 1 FROM suppliers WHERE name=?", (name,)).fetchone():
                return self.send_json({"error": "Bu yetkazib beruvchi bor"}, 400)
            conn.execute(
                "INSERT INTO suppliers(name,phone,note,created_at) VALUES(?,?,?,?)",
                (name, (data.get("phone") or "").strip(), (data.get("note") or "").strip(), now()),
            )
            conn.commit()
            return self.send_json({"ok": True})
        finally:
            conn.close()

    def handle_assets_post(self, user, path):
        if user["role"] not in ("admin", "oper", "axo"):
            return self.send_json({"error": "Aktivlarni faqat AXO/Admin boshqaradi"}, 403)
        conn = db()
        try:
            if path.endswith("/delete"):
                aid = int(path.split("/")[3])
                conn.execute("DELETE FROM assets WHERE id=?", (aid,))
                conn.commit()
                return self.send_json({"ok": True})
            data = self.read_json()
            name = (data.get("name") or "").strip()
            if not name:
                return self.send_json({"error": "Nom kiritilmadi"}, 400)
            bid = data.get("branch_id")
            try:
                bid = int(bid)
            except (TypeError, ValueError):
                bid = None
            conn.execute(
                "INSERT INTO assets(branch_id,name,category,serial,purchase_date,warranty_until,note,created_at) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (bid, name, (data.get("category") or "").strip(), (data.get("serial") or "").strip(),
                 (data.get("purchase_date") or "").strip(), (data.get("warranty_until") or "").strip(),
                 (data.get("note") or "").strip(), now()),
            )
            conn.commit()
            return self.send_json({"ok": True})
        finally:
            conn.close()

    # --- Admin ---
    def handle_admin(self, path):
        data = self.read_json()
        conn = db()
        try:
            # Foydalanuvchi qo'shish
            if path == "/api/users":
                username = (data.get("username") or "").strip()
                pw = data.get("password") or ""
                role = data.get("role") or ""
                full_name = (data.get("full_name") or "").strip()
                if not username or not pw or not full_name or role not in ROLES:
                    return self.send_json({"error": "Barcha maydonlarni to'g'ri to'ldiring"}, 400)
                if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
                    return self.send_json({"error": "Bu login band"}, 400)
                # branch_id: butun son bo'lsa saqlanadi, "all"/bo'sh bo'lsa NULL (barcha filiallar)
                bid = data.get("branch_id")
                try:
                    bid = int(bid)
                except (TypeError, ValueError):
                    bid = None
                ph, salt = hash_password(pw)
                conn.execute(
                    "INSERT INTO users(username,password_hash,salt,role,full_name,branch_id) VALUES(?,?,?,?,?,?)",
                    (username, ph, salt, role, full_name, bid),
                )
                conn.commit()
                return self.send_json({"ok": True})

            # Parolni o'zgartirish
            if path.endswith("/password"):
                uid = int(path.split("/")[3])
                pw = data.get("password") or ""
                if len(pw) < 1:
                    return self.send_json({"error": "Parol bo'sh"}, 400)
                ph, salt = hash_password(pw)
                conn.execute("UPDATE users SET password_hash=?, salt=? WHERE id=?", (ph, salt, uid))
                conn.commit()
                return self.send_json({"ok": True})

            # Foydalanuvchini o'chirish
            if path.startswith("/api/users/") and path.endswith("/delete"):
                uid = int(path.split("/")[3])
                u = conn.execute("SELECT username FROM users WHERE id=?", (uid,)).fetchone()
                if u and u["username"] == "admin":
                    return self.send_json({"error": "Asosiy adminni o'chirib bo'lmaydi"}, 400)
                conn.execute("DELETE FROM users WHERE id=?", (uid,))
                conn.commit()
                return self.send_json({"ok": True})

            # Filial qo'shish
            if path == "/api/branches":
                name = (data.get("name") or "").strip()
                status = data.get("status") or "active"
                if status not in ("active", "construction"):
                    status = "active"
                if not name:
                    return self.send_json({"error": "Nom kiritilmadi"}, 400)
                if conn.execute("SELECT 1 FROM branches WHERE name=?", (name,)).fetchone():
                    return self.send_json({"error": "Bu filial allaqachon bor"}, 400)
                conn.execute("INSERT INTO branches(name,status) VALUES(?,?)", (name, status))
                conn.commit()
                return self.send_json({"ok": True})

            # Filialni faollashtirish (qurilish tugadi -> savdoda)
            if path.startswith("/api/branches/") and path.endswith("/activate"):
                bid = int(path.split("/")[3])
                conn.execute("UPDATE branches SET status='active' WHERE id=?", (bid,))
                conn.commit()
                return self.send_json({"ok": True})

            # Filialni o'chirish
            if path.startswith("/api/branches/") and path.endswith("/delete"):
                bid = int(path.split("/")[3])
                used = conn.execute("SELECT 1 FROM requests WHERE branch_id=? LIMIT 1", (bid,)).fetchone()
                if used:
                    return self.send_json({"error": "Bu filialga bog'liq zayavkalar bor, o'chirib bo'lmaydi"}, 400)
                conn.execute("UPDATE users SET branch_id=NULL WHERE branch_id=?", (bid,))
                conn.execute("DELETE FROM branches WHERE id=?", (bid,))
                conn.commit()
                return self.send_json({"ok": True})

            return self.send_json({"error": "Noma'lum amal"}, 404)
        finally:
            conn.close()

    # --- util ---
    def user_dict(self, u):
        conn = db()
        branch = None
        if u["branch_id"]:
            b = conn.execute("SELECT name FROM branches WHERE id=?", (u["branch_id"],)).fetchone()
            branch = b["name"] if b else None
        conn.close()
        return {
            "id": u["id"],
            "username": u["username"],
            "full_name": u["full_name"],
            "role": u["role"],
            "role_label": ROLES.get(u["role"], u["role"]),
            "branch": branch,
        }


def main():
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("=" * 50)
    print("  AXO-OPEN group tizimi ishga tushdi")
    print(f"  Brauzerda oching:  http://localhost:{PORT}")
    print("=" * 50)
    print("  To'xtatish uchun: Ctrl + C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")


if __name__ == "__main__":
    main()
