# -*- coding: utf-8 -*-
"""
app.db (eski SQLite) -> Supabase (yangi SaaS) ma'lumot ko'chirish.
Faqat Python standart kutubxonasi (urllib) — qo'shimcha o'rnatish shart emas.

Ishlatish (PowerShell):
  $env:SUPABASE_URL="https://xxxx.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
  python scripts/migrate_from_sqlite.py ../app.db

Eski foydalanuvchilar emailsiz edi. Har biriga sintetik email yaratiladi:
  <username>@<org-domen>   (masalan nohiya6@zahratun.local)
va umumiy boshlang'ich parol beriladi (keyin almashtiriladi).
"""
import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ORG_NAME = os.environ.get("MIGRATE_ORG_NAME", "Zahratun fast-food")
EMAIL_DOMAIN = os.environ.get("MIGRATE_EMAIL_DOMAIN", "zahratun.local")
DEFAULT_PASSWORD = os.environ.get("MIGRATE_DEFAULT_PASSWORD", "Axo2026!")

if not SUPABASE_URL or not SERVICE_KEY:
    print("XATO: SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY muhit o'zgaruvchilarini bering.")
    sys.exit(1)

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else "../app.db"


def _req(method, path, body=None, prefer=None):
    url = SUPABASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code}: {e.read().decode()[:300]}")
        return None


def insert(table, rows, returning=False):
    """PostgREST orqali qator(lar) qo'shish."""
    if not rows:
        return []
    prefer = "return=representation" if returning else "return=minimal"
    res = _req("POST", f"/rest/v1/{table}", rows, prefer=prefer)
    return res or []


def create_auth_user(email, password, full_name):
    res = _req("POST", "/auth/v1/admin/users", {
        "email": email, "password": password, "email_confirm": True,
        "user_metadata": {"full_name": full_name},
    })
    if res and res.get("id"):
        return res["id"]
    return None


def parse_photos(row, keys=("photos_json", "photo")):
    photos = []
    for k in keys:
        try:
            v = row[k]
        except (IndexError, KeyError):
            v = None
        if not v:
            continue
        if k == "photo":
            photos.append(v)
        else:
            try:
                arr = json.loads(v)
                if isinstance(arr, list):
                    photos.extend(arr)
            except Exception:
                pass
    return photos


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    print(f"Manba: {DB_PATH}")
    print(f"Supabase: {SUPABASE_URL}")

    # 1) Korxona
    org = insert("organizations", [{"name": ORG_NAME}], returning=True)
    if not org:
        print("XATO: organization yaratilmadi."); return
    org_id = org[0]["id"]
    print(f"Korxona yaratildi: {org_id}")

    # 2) Foydalanuvchilar -> auth + profiles
    user_map = {}   # eski user id -> yangi uuid
    users = c.execute("SELECT * FROM users").fetchall()
    print(f"Foydalanuvchilar: {len(users)}")
    for u in users:
        email = f"{u['username']}@{EMAIL_DOMAIN}"
        uid = create_auth_user(email, DEFAULT_PASSWORD, u["full_name"])
        if not uid:
            print(f"  ! {u['username']} auth yaratilmadi (mavjud bo'lishi mumkin), o'tkazib yuborildi")
            continue
        user_map[u["id"]] = uid
        insert("profiles", [{
            "id": uid, "org_id": org_id, "full_name": u["full_name"],
            "role": u["role"], "branch_id": None,  # branch_id keyin yangilanadi
        }])
    print(f"  -> {len(user_map)} foydalanuvchi ko'chirildi (parol: {DEFAULT_PASSWORD})")

    # 3) Filiallar
    branch_map = {}  # eski id -> yangi id
    branches = c.execute("SELECT * FROM branches").fetchall()
    for b in branches:
        regmen_old = b["regmen_id"] if "regmen_id" in b.keys() else None
        rows = insert("branches", [{
            "org_id": org_id, "name": b["name"],
            "status": b["status"] if "status" in b.keys() and b["status"] else "active",
            "regmen_id": user_map.get(regmen_old),
        }], returning=True)
        if rows:
            branch_map[b["id"]] = rows[0]["id"]
    print(f"Filiallar: {len(branch_map)}")

    # 3b) profiles.branch_id ni yangilash
    for u in users:
        if u["id"] in user_map and u["branch_id"] and u["branch_id"] in branch_map:
            _req("PATCH", f"/rest/v1/profiles?id=eq.{user_map[u['id']]}",
                 {"branch_id": branch_map[u["branch_id"]]})

    # 3c) user_branches
    ub_rows = []
    for ub in c.execute("SELECT * FROM user_branches").fetchall():
        if ub["user_id"] in user_map and ub["branch_id"] in branch_map:
            ub_rows.append({"org_id": org_id, "user_id": user_map[ub["user_id"]],
                            "branch_id": branch_map[ub["branch_id"]]})
    insert("user_branches", ub_rows)

    # 4) Zayavkalar
    req_map = {}
    reqs = c.execute("SELECT * FROM requests").fetchall()
    for r in reqs:
        if r["created_by"] not in user_map:
            continue
        rows = insert("requests", [{
            "org_id": org_id, "type": r["type"], "title": r["title"],
            "description": r["description"], "branch_id": branch_map.get(r["branch_id"]),
            "created_by": user_map[r["created_by"]], "status": r["status"],
            "deadline": r["deadline"], "deadline_confirmed": bool(r["deadline_confirmed"]),
            "rejected_by": user_map.get(r["rejected_by"]),
            "suggested_deadline": r["suggested_deadline"],
            "deadline_disputed": bool(r["deadline_disputed"]),
            "limit_amount": r["limit_amount"],
            "limit_type": (r["limit_type"] if "limit_type" in r.keys() else "soft") or "soft",
            "photos_json": parse_photos(r),
            "estimated_amount": r["estimated_amount"] if "estimated_amount" in r.keys() else None,
            "estimated_currency": (r["estimated_currency"] if "estimated_currency" in r.keys() else "so'm"),
            "estimated_category": r["estimated_category"] if "estimated_category" in r.keys() else None,
            "escalated": bool(r["escalated"]) if "escalated" in r.keys() else False,
            "created_at": r["created_at"],
        }], returning=True)
        if rows:
            req_map[r["id"]] = rows[0]["id"]
    print(f"Zayavkalar: {len(req_map)}")

    # 5) Events
    ev_rows = []
    for e in c.execute("SELECT * FROM events").fetchall():
        if e["request_id"] not in req_map:
            continue
        ev_rows.append({"org_id": org_id, "request_id": req_map[e["request_id"]],
                        "user_id": user_map.get(e["user_id"]), "action": e["action"],
                        "comment": e["comment"], "created_at": e["created_at"]})
    insert("events", ev_rows)
    print(f"Tarix (events): {len(ev_rows)}")

    # 6) Reports + items
    report_map = {}
    for rep in c.execute("SELECT * FROM reports").fetchall():
        if rep["request_id"] not in req_map:
            continue
        rows = insert("reports", [{
            "org_id": org_id, "request_id": req_map[rep["request_id"]],
            "note": rep["note"], "total": rep["total"],
            "photos_json": parse_photos(rep),
            "submitted_by": user_map.get(rep["submitted_by"]),
            "created_at": rep["created_at"],
        }], returning=True)
        if rows:
            report_map[rep["id"]] = rows[0]["id"]
    item_rows = []
    for it in c.execute("SELECT * FROM report_items").fetchall():
        if it["report_id"] not in report_map:
            continue
        item_rows.append({"org_id": org_id, "report_id": report_map[it["report_id"]],
                          "name": it["name"], "category": it["category"] if "category" in it.keys() else None,
                          "supplier": it["supplier"] if "supplier" in it.keys() else None,
                          "qty": it["qty"], "price": it["price"]})
    insert("report_items", item_rows)
    print(f"Hisobotlar: {len(report_map)}, qatorlar: {len(item_rows)}")

    # 7) Comments
    cm_rows = []
    for cm in c.execute("SELECT * FROM comments").fetchall():
        if cm["request_id"] not in req_map or cm["user_id"] not in user_map:
            continue
        cm_rows.append({"org_id": org_id, "request_id": req_map[cm["request_id"]],
                        "user_id": user_map[cm["user_id"]], "text": cm["text"],
                        "created_at": cm["created_at"]})
    insert("comments", cm_rows)

    # 8) Notifications
    nt_rows = []
    for n in c.execute("SELECT * FROM notifications").fetchall():
        if n["user_id"] not in user_map:
            continue
        nt_rows.append({"org_id": org_id, "user_id": user_map[n["user_id"]],
                        "request_id": req_map.get(n["request_id"]), "text": n["text"],
                        "is_read": bool(n["is_read"]), "created_at": n["created_at"]})
    insert("notifications", nt_rows)

    # 9) Budgets
    bg_rows = []
    for b in c.execute("SELECT * FROM budgets").fetchall():
        if b["branch_id"] not in branch_map:
            continue
        bg_rows.append({"org_id": org_id, "branch_id": branch_map[b["branch_id"]],
                        "month": b["month"], "amount": b["amount"]})
    insert("budgets", bg_rows)

    # 10) Assets
    as_rows = []
    for a in c.execute("SELECT * FROM assets").fetchall():
        as_rows.append({"org_id": org_id, "branch_id": branch_map.get(a["branch_id"]),
                        "name": a["name"], "category": a["category"], "serial": a["serial"],
                        "purchase_date": a["purchase_date"], "warranty_until": a["warranty_until"],
                        "note": a["note"], "created_at": a["created_at"]})
    insert("assets", as_rows)

    # 11) Limits
    lm_rows = []
    for l in c.execute("SELECT * FROM limits").fetchall():
        ref = l["ref"]
        # branch/user doiralari uchun eski id -> yangi id
        if l["scope"] == "branch":
            ref = str(branch_map.get(int(ref), ref)) if str(ref).isdigit() else ref
        elif l["scope"] == "user":
            ref = str(user_map.get(int(ref), ref)) if str(ref).isdigit() else ref
        lm_rows.append({"org_id": org_id, "scope": l["scope"], "ref": str(ref), "amount": l["amount"]})
    insert("limits", lm_rows)

    # 11b) Rol qobiliyatlari (role_perms) — standart qiymatlar
    ROLES_ALL = ["admin", "oper", "branch_manager", "regmen", "axo", "finance",
                 "ceo", "ops_director", "open_group", "hr"]
    DEFAULT_PERMS = {
        "create_maintenance": ["branch_manager", "axo", "regmen", "open_group", "admin"],
        "create_new_branch": ["open_group", "admin"],
        "view_analytics": ["admin", "oper", "ceo", "finance", "ops_director", "open_group", "regmen"],
        "manage_limits": ["admin", "oper", "ceo", "finance"],
        "manage_settings": ["admin", "oper"],
    }
    perm_rows = []
    for role in ROLES_ALL:
        for perm, allowed_roles in DEFAULT_PERMS.items():
            perm_rows.append({"org_id": org_id, "role": role, "perm": perm,
                              "allowed": role in allowed_roles})
    insert("role_perms", perm_rows)
    print(f"Ruxsatlar (role_perms): {len(perm_rows)}")

    # 12) Settings
    for key in ("ceo_threshold", "axo_open_limit"):
        row = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        if row:
            _req("POST", "/rest/v1/org_settings", [{"org_id": org_id, "key": key, "value": row["value"]}],
                 prefer="resolution=merge-duplicates")

    conn.close()
    print("\n✅ Ko'chirish yakunlandi!")
    print(f"   Kirish: <username>@{EMAIL_DOMAIN}  parol: {DEFAULT_PASSWORD}")
    print("   Masalan: admin@%s / %s" % (EMAIL_DOMAIN, DEFAULT_PASSWORD))


if __name__ == "__main__":
    main()
