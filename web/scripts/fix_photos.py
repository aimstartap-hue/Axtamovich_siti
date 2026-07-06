# -*- coding: utf-8 -*-
"""
Eski uploads/ papkasidagi rasm fayllarini Supabase Storage ('photos') ga yuklaydi
va requests/reports dagi photos_json ichidagi '/uploads/...' manzillarini
yangi public URL ga almashtiradi.

Ishlatish:
  $env:SUPABASE_URL="https://xxxx.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="<secret>"
  python scripts/fix_photos.py ../uploads
"""
import os, sys, json, mimetypes, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
UPLOADS = sys.argv[1] if len(sys.argv) > 1 else "../uploads"

def _req(method, path, body=None, headers=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if headers: h.update(headers)
    r = urllib.request.Request(URL + path, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw and raw.strip().startswith(("[", "{")) else raw
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_msg": e.read().decode()[:200]}

def upload_file(name, data):
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    res = _req("POST", f"/storage/v1/object/photos/{name}", data,
               {"Content-Type": ctype, "x-upsert": "true"})
    return not (isinstance(res, dict) and res.get("_err"))

def public_url(name):
    return f"{URL}/storage/v1/object/public/photos/{name}"

def main():
    # 1) Fayllarni yuklash
    uploaded = {}
    for fn in os.listdir(UPLOADS):
        p = os.path.join(UPLOADS, fn)
        if not os.path.isfile(p) or fn.startswith("."):
            continue
        with open(p, "rb") as f:
            data = f.read()
        if len(data) < 100:   # 70-baytlik bo'sh placeholder'larni o'tkazib yuborish
            print(f"  o'tkazib yuborildi (juda kichik): {fn}")
            continue
        ok = upload_file(fn, data)
        if ok:
            uploaded[fn] = public_url(fn)
            print(f"  yuklandi: {fn}")
        else:
            print(f"  ! yuklanmadi: {fn}")

    # 2) requests va reports dagi photos_json ni yangilash
    def fix_table(table):
        rows = _req("GET", f"/rest/v1/{table}?select=id,photos_json")
        if not isinstance(rows, list):
            print(f"  {table}: o'qib bo'lmadi"); return
        for row in rows:
            pj = row.get("photos_json") or []
            if not pj: continue
            new = []
            changed = False
            for u in pj:
                base = os.path.basename(str(u))
                if base in uploaded:
                    new.append(uploaded[base]); changed = True
                elif str(u).startswith("http"):
                    new.append(u)
                else:
                    new.append(u)  # topilmasa qoldiramiz
            if changed:
                _req("PATCH", f"/rest/v1/{table}?id=eq.{row['id']}",
                     json.dumps({"photos_json": new}).encode(),
                     {"Content-Type": "application/json"})
                print(f"  {table} #{row['id']} yangilandi")

    fix_table("requests")
    fix_table("reports")
    print(f"\nTayyor. {len(uploaded)} ta rasm yuklandi va manzillar yangilandi.")

if __name__ == "__main__":
    main()
