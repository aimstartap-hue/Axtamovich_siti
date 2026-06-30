// AXO-OPEN group — frontend
let ME = null;
let CURRENT_FILTER = "all";
let TYPE_FILTER = "all";       // all | maintenance | new_branch
let CURRENT_VIEW = "requests";
let CATEGORIES = [];
let META_GROUPS = {};
let META_TYPE_GROUPS = {};
let REPORT_TYPE = "maintenance";

// ======================= SOZLAMALAR (til / mavzu / rang) =======================
let LANG = localStorage.getItem("axo_lang") || "uz";
let THEME = localStorage.getItem("axo_theme") || "dark";
let ACCENT = localStorage.getItem("axo_accent") || "#4f7cff";
const ACCENTS = ["#4f7cff", "#2fbf71", "#7c5cff", "#f5a623", "#e5484d", "#0ea5e9"];

const I18N = {
    uz: {
        tagline: "Ko'p tarmoqli bizneslar uchun AXO boshqaruv tizimi",
        login: "Login", password: "Parol", signin: "Kirish", logout: "Chiqish",
        demo_logins: "Sinov uchun loginlar",
        appearance: "Ko'rinish sozlamalari", language: "Til", theme: "Mavzu",
        dark: "Qora", light: "Oq", accent: "Asosiy rang",
        dashboard: "Boshqaruv paneli", all_requests: "Barcha zayavkalar",
        maintenance_requests: "🔧 Texnik zayavkalar", new_branch_requests: "🏗 Yangi filial so'rovlari",
        reports: "📈 Hisobot va analitika", settings: "Sozlamalar",
        reports_title: "Hisobot va analitika",
        new_request: "+ Yangi zayavka", new_branch_req: "+ Yangi filial so'rovi",
        f_all: "Hammasi", f_mine: "⚡ Menga kerak", f_active: "Faol", f_closed: "Yopilgan",
        total_requests: "Jami zayavka", active: "Faol", closed: "Yopilgan", rejected: "Rad etilgan",
        total_spend: "Umumiy xarajat", need_action: "Sizdan harakat talab qilinadi",
        recent: "So'nggi harakatlar", quick: "Tezkor ko'rinish", no_data: "Ma'lumot yo'q",
    },
    ru: {
        tagline: "Система управления АХО для сетевого бизнеса",
        login: "Логин", password: "Пароль", signin: "Войти", logout: "Выход",
        demo_logins: "Тестовые логины",
        appearance: "Настройки внешнего вида", language: "Язык", theme: "Тема",
        dark: "Тёмная", light: "Светлая", accent: "Основной цвет",
        dashboard: "Панель управления", all_requests: "Все заявки",
        maintenance_requests: "🔧 Технические заявки", new_branch_requests: "🏗 Заявки на новый филиал",
        reports: "📈 Отчёты и аналитика", settings: "Настройки",
        reports_title: "Отчёты и аналитика",
        new_request: "+ Новая заявка", new_branch_req: "+ Заявка на филиал",
        f_all: "Все", f_mine: "⚡ Требуют меня", f_active: "Активные", f_closed: "Закрытые",
        total_requests: "Всего заявок", active: "Активные", closed: "Закрытые", rejected: "Отклонённые",
        total_spend: "Общие расходы", need_action: "Требуют вашего действия",
        recent: "Последние действия", quick: "Быстрый обзор", no_data: "Нет данных",
    },
};
const t = (key) => (I18N[LANG] && I18N[LANG][key]) || I18N.uz[key] || key;

function applySettings() {
    document.body.classList.toggle("light-theme", THEME === "light");
    document.body.style.setProperty("--primary", ACCENT);
    // i18n: data-i18n (matn) va data-i18n-ph (placeholder)
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = LANG;
    // segment tugmalari holati
    document.querySelectorAll("#seg-lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === LANG));
    document.querySelectorAll("#seg-theme button").forEach((b) => b.classList.toggle("on", b.dataset.theme === THEME));
    document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("on", b.dataset.lang === LANG));
    document.querySelectorAll("#accent-swatches .swatch").forEach((b) => b.classList.toggle("on", b.dataset.color === ACCENT));
}
function setLang(l) { LANG = l; localStorage.setItem("axo_lang", l); applySettings(); if (ME) refreshCurrentView(); }
function setTheme(th) { THEME = th; localStorage.setItem("axo_theme", th); applySettings(); }
function setAccent(c) { ACCENT = c; localStorage.setItem("axo_accent", c); applySettings(); }
function refreshCurrentView() {
    if (CURRENT_VIEW === "requests") loadRequests();
    else if (CURRENT_VIEW === "stats") loadStats();
    else if (CURRENT_VIEW === "admin") loadAdmin();
    else if (CURRENT_VIEW === "dashboard") loadDashboard();
}

const $ = (s) => document.querySelector(s);
const api = async (url, method = "GET", body = null) => {
    const opt = { method, headers: {} };
    if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const res = await fetch(url, opt);
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
};
const fmtMoney = (n) => (Number(n) || 0).toLocaleString("ru-RU") + " so'm";

// ---- fayl -> base64 ----
function fileToDataUrl(file) {
    return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(file);
    });
}

// ---------------- AUTH ----------------
async function checkAuth() {
    const { data } = await api("/api/me");
    if (data && data.user) { ME = data.user; showApp(); }
    else { showLogin(); }
}
function showLogin() { $("#login-screen").classList.remove("hidden"); $("#app").classList.add("hidden"); }
async function showApp() {
    $("#login-screen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#user-name").textContent = ME.full_name;
    $("#user-role").textContent = ME.role_label + (ME.branch ? " · " + ME.branch : "");
    const isAdmin = ME.role === "admin" || ME.role === "oper";
    // tugmalarni rolga qarab ko'rsatish
    $("#new-maintenance-btn").classList.toggle("hidden", !(ME.role === "branch_manager" || ME.role === "admin"));
    $("#new-branch-btn").classList.toggle("hidden", !(ME.role === "open_group" || ME.role === "admin"));
    $("#menu-admin").classList.toggle("hidden", !isAdmin);
    $("#bn-add").classList.toggle("hidden", !(ME.role === "branch_manager" || ME.role === "open_group" || ME.role === "admin"));
    applySettings();
    // rasxod turlari (bo'limlar bilan)
    const { data: meta } = await api("/api/meta");
    CATEGORIES = (meta && meta.categories) || [];
    META_GROUPS = (meta && meta.groups) || {};
    META_TYPE_GROUPS = (meta && meta.type_groups) || {};
    // Operator to'g'ridan-to'g'ri sozlamalarga, qolganlar Boshqaruv paneliga
    if (ME.role === "oper") switchView("admin");
    else switchView("dashboard");
    // bildirishnomalar
    loadNotifications(false);
    if (window.__notifTimer) clearInterval(window.__notifTimer);
    window.__notifTimer = setInterval(() => loadNotifications(false), 30000);
}

// ---------------- NAVIGATION (Menyu) ----------------
function switchView(view, type) {
    CURRENT_VIEW = view;
    if (type !== undefined) { TYPE_FILTER = type; CURRENT_FILTER = "all"; }
    document.querySelectorAll(".menu-item").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view && (b.dataset.type || "") === (b.dataset.view === "requests" ? TYPE_FILTER : "")));
    document.querySelectorAll("#bottom-nav .bn-item[data-view]").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    $("#view-" + view).classList.remove("hidden");
    // sarlavha
    if (view === "requests") {
        $("#requests-title").textContent =
            TYPE_FILTER === "maintenance" ? t("maintenance_requests") :
            TYPE_FILTER === "new_branch" ? t("new_branch_requests") : "📋 " + t("all_requests");
        // chiplar holatini tiklash
        document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x.dataset.filter === "all"));
        loadRequests();
    }
    if (view === "stats") loadStats();
    if (view === "admin") loadAdmin();
    if (view === "dashboard") loadDashboard();
    closeDrawer();
}
function openDrawer() { $("#drawer").classList.remove("hidden"); $("#drawer-overlay").classList.remove("hidden"); }
function closeDrawer() { $("#drawer").classList.add("hidden"); $("#drawer-overlay").classList.add("hidden"); }
$("#menu-toggle").onclick = openDrawer;
$("#drawer-overlay").onclick = closeDrawer;
document.querySelectorAll(".menu-item").forEach((b) => {
    b.onclick = () => switchView(b.dataset.view, b.dataset.view === "requests" ? (b.dataset.type || "all") : undefined);
});

// ---------------- SOZLAMALAR popover ----------------
function buildSwatches() {
    $("#accent-swatches").innerHTML = ACCENTS.map((c) =>
        `<button class="swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("");
    document.querySelectorAll("#accent-swatches .swatch").forEach((b) => { b.onclick = () => setAccent(b.dataset.color); });
}
$("#settings-toggle").onclick = (e) => { e.stopPropagation(); $("#settings-pop").classList.toggle("hidden"); };
document.addEventListener("click", (e) => {
    const pop = $("#settings-pop");
    if (pop && !pop.classList.contains("hidden") && !pop.contains(e.target) && e.target.id !== "settings-toggle") {
        pop.classList.add("hidden");
    }
});
document.querySelectorAll("#seg-lang button").forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
document.querySelectorAll("#seg-theme button").forEach((b) => { b.onclick = () => setTheme(b.dataset.theme); });
document.querySelectorAll(".lang-btn").forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
$("#drawer-theme").onclick = () => setTheme(THEME === "dark" ? "light" : "dark");

// ---------------- BILDIRISHNOMALAR ----------------
async function loadNotifications(openPanel) {
    const { data } = await api("/api/notifications");
    if (!data) return;
    const badge = $("#notif-badge");
    badge.textContent = data.unread;
    badge.classList.toggle("hidden", !data.unread);
    if (openPanel) {
        const list = $("#notif-list");
        list.innerHTML = data.items.length ? data.items.map((n) => `
            <div class="notif-item ${n.is_read ? "" : "unread"}" ${n.request_id ? `onclick="openNotif(${n.request_id})"` : ""}>
                <div class="ni-text">${esc(n.text)}</div>
                <div class="ni-at">${n.at}</div>
            </div>`).join("") : `<p class="muted" style="padding:8px">Bildirishnoma yo'q.</p>`;
    }
}
function openNotif(rid) { $("#notif-pop").classList.add("hidden"); openDetail(rid); }
$("#notif-toggle").onclick = async (e) => {
    e.stopPropagation();
    const pop = $("#notif-pop");
    const willOpen = pop.classList.contains("hidden");
    pop.classList.toggle("hidden");
    $("#settings-pop").classList.add("hidden");
    if (willOpen) { await loadNotifications(true); await api("/api/notifications/read", "POST"); loadNotifications(false); }
};
$("#notif-readall").onclick = async (e) => { e.stopPropagation(); await api("/api/notifications/read", "POST"); loadNotifications(true); };
document.addEventListener("click", (e) => {
    const pop = $("#notif-pop");
    if (pop && !pop.classList.contains("hidden") && !pop.contains(e.target) && e.target.id !== "notif-toggle") pop.classList.add("hidden");
});

$("#login-btn").onclick = async () => {
    const { ok, data } = await api("/api/login", "POST", {
        username: $("#login-username").value.trim(),
        password: $("#login-password").value,
    });
    if (ok) { ME = data.user; showApp(); }
    else { $("#login-error").textContent = (data && data.error) || "Xatolik"; }
};
$("#login-password").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#login-btn").click(); });
$("#logout-btn").onclick = async () => { await api("/api/logout", "POST"); ME = null; location.reload(); };

// ---------------- LIST ----------------
document.querySelectorAll(".chip").forEach((c) => {
    c.onclick = () => {
        document.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        CURRENT_FILTER = c.dataset.filter;
        loadRequests();
    };
});

if ($("#search-box")) {
    let st;
    $("#search-box").addEventListener("input", () => { clearTimeout(st); st = setTimeout(loadRequests, 200); });
}

async function loadRequests() {
    const { data } = await api("/api/requests");
    const list = $("#requests-list");
    let items = data || [];

    // bildirishnoma belgisi (menga kerak bo'lgan zayavkalar soni)
    const needCount = items.filter((r) => r.needs_my_action).length;
    [$("#menu-badge"), $("#menu-badge2")].forEach((badge) => {
        badge.textContent = needCount;
        badge.classList.toggle("hidden", needCount === 0);
    });

    // tur bo'yicha filtr (menyu)
    if (TYPE_FILTER !== "all") items = items.filter((r) => r.type === TYPE_FILTER);

    if (CURRENT_FILTER === "mine") items = items.filter((r) => r.needs_my_action);
    if (CURRENT_FILTER === "active") items = items.filter((r) => !["closed", "rejected"].includes(r.status));
    if (CURRENT_FILTER === "closed") items = items.filter((r) => ["closed", "rejected"].includes(r.status));

    // qidiruv
    const q = ($("#search-box") ? $("#search-box").value : "").trim().toLowerCase();
    if (q) {
        const qn = q.replace("#", "");
        items = items.filter((r) =>
            (r.title || "").toLowerCase().includes(q) ||
            (r.branch || "").toLowerCase().includes(q) ||
            (r.created_by || "").toLowerCase().includes(q) ||
            String(r.id) === qn ||
            (r.status_label || "").toLowerCase().includes(q));
    }

    if (!items.length) {
        list.innerHTML = `<div class="empty">${CURRENT_FILTER === "mine" ? "Sizdan harakat talab qilinadigan zayavka yo'q. ✅" : "Hozircha zayavkalar yo'q."}</div>`;
        return;
    }
    list.innerHTML = items.map(cardHtml).join("");
    list.querySelectorAll(".card").forEach((el) => {
        el.onclick = () => openDetail(el.dataset.id);
    });
}

function cardHtml(r) {
    const typeLabel = r.type === "new_branch" ? "Yangi filial" : "Texnik zayavka";
    const actionTag = r.needs_my_action ? `<span class="action-tag">⚡ Siz harakat qiling</span>` : "";
    return `
    <div class="card ${r.needs_my_action ? "card-action" : ""}" data-id="${r.id}">
        <div class="card-head">
            <div>
                <span class="type-tag type-${r.type}">${typeLabel}</span> ${actionTag}
                <div class="card-title">${esc(r.title)}</div>
                <div class="card-meta">
                    <span>#${r.id}</span>
                    ${r.branch ? `<span>📍 ${esc(r.branch)}</span>` : ""}
                    <span>👤 ${esc(r.created_by)}</span>
                    ${r.deadline ? `<span class="${r.overdue ? "overdue" : "deadline"}">📅 ${r.deadline}${r.overdue ? " (muddat o'tdi!)" : ""}${r.deadline_confirmed ? " ✅" : ""}</span>` : ""}
                    <span>🕓 ${r.created_at}</span>
                </div>
            </div>
            <span class="status s-${r.status}">${r.status_label}</span>
        </div>
        ${r.description ? `<div class="card-desc">${esc(r.description)}</div>` : ""}
    </div>`;
}

// ---------------- DETAIL ----------------
async function openDetail(id) {
    const { data: r } = await api("/api/requests/" + id);
    if (!r || r.error) return;
    const typeLabel = r.type === "new_branch" ? "Yangi filial so'rovi" : "Texnik zayavka";

    let actions = "";
    if (r.can_approve) {
        let approveLabel = "Tasdiqlash";
        if (r.status === "report_submitted") approveLabel = "Hisobotni tasdiqlash (yopish)";
        else if (r.status === "pending_axo") approveLabel = "AXO: tasdiqlash";
        else if (r.sets_deadline) approveLabel = "Tasdiqlash + muddat";
        else if (r.sets_limit) approveLabel = "Tasdiqlash (muddat + limit)";
        actions = `
            <button class="btn btn-green" onclick='doApprove(${r.id}, ${r.sets_deadline ? "true" : "false"}, ${r.sets_limit ? "true" : "false"})'>${approveLabel}</button>
            <button class="btn btn-red" onclick="doReject(${r.id})">Rad etish</button>`;
    }
    if (r.can_resolve_dispute) {
        actions += `<button class="btn btn-primary" onclick='openResolveDispute(${r.id}, ${JSON.stringify(r.suggested_deadline || r.deadline || "")})'>📅 Muddat nizosini hal qilish</button>`;
    }
    if (r.can_request_deadline_change) {
        actions += `<button class="btn btn-ghost" onclick="openDeadlineChange(${r.id}, '${r.deadline || ""}')">📅 Sanani o'zgartirishni so'rash</button>`;
    }
    if (r.can_submit_report) {
        actions += `<button class="btn btn-primary" onclick="openReportForm(${r.id}, '${r.type}')">Foto-hisobot topshirish</button>`;
    }
    if (r.can_reopen) {
        actions += `<button class="btn btn-green" onclick="doReopen(${r.id})">♻️ Qayta imkon berish</button>`;
    }
    if (r.can_send_to_hr) {
        actions += `<button class="btn btn-red" onclick="openSendToHr(${r.id})">🧾 HR ga yo'naltirish (oylikdan kesish)</button>`;
    }
    if (r.can_hr_resolve) {
        actions += `<button class="btn btn-green" onclick="doHrResolve(${r.id})">✅ Hal qilindi (yopish)</button>`;
    }

    const photoHtml = r.photo ? `<img src="${r.photo}" class="photo-thumb">` : "";

    const reportsHtml = (r.reports || []).map((rep) => `
        <div class="report-box">
            <div class="muted">${esc(rep.by)} · ${rep.at}</div>
            ${rep.note ? `<p style="margin:8px 0">${esc(rep.note)}</p>` : ""}
            ${rep.items.length ? `
            <table class="items-table">
                <tr><th>Rasxod turi</th><th>Nomi</th><th>Soni</th><th>Narxi</th><th>Jami</th></tr>
                ${rep.items.map((i) => `<tr><td>${esc(i.category || "—")}</td><td>${esc(i.name)}</td><td>${i.qty}</td><td>${fmtMoney(i.price)}</td><td>${fmtMoney(i.qty * i.price)}</td></tr>`).join("")}
            </table>` : ""}
            <div class="total-line">Jami: ${fmtMoney(rep.total)}</div>
            ${rep.photos.length ? `<div class="photo-grid" style="margin-top:10px">${rep.photos.map((p) => `<img src="${p}" onclick="window.open('${p}')">`).join("")}</div>` : ""}
        </div>`).join("");

    const timeline = (r.events || []).map((e) => `
        <li>
            <div class="tl-action">${esc(e.action)}</div>
            <div class="tl-meta">${esc(e.user)} ${e.role ? "· " + esc(e.role) : ""} · ${e.at}</div>
            ${e.comment ? `<div class="tl-comment">"${esc(e.comment)}"</div>` : ""}
        </li>`).join("");

    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <span class="type-tag type-${r.type}">${typeLabel}</span>
        <h3>${esc(r.title)}</h3>
        <div class="info-row">
            <span>#${r.id}</span>
            ${r.branch ? `<span>📍 ${esc(r.branch)}</span>` : ""}
            <span>👤 ${esc(r.created_by)} (${esc(r.created_by_role)})</span>
            <span class="status s-${r.status}">${r.status_label}</span>
        </div>
        ${r.deadline ? `<div class="deadline-box ${r.overdue ? "overdue-box" : ""}">📅 Muddat: <b>${r.deadline}</b> ${r.deadline_confirmed ? '<span class="ok-tag">✅ Moliya tasdiqladi</span>' : '<span class="muted">— moliya tasdig\'i kutilmoqda</span>'} ${r.overdue ? '<span class="overdue">— muddat o\'tib ketdi!</span>' : ""}</div>` : ""}
        ${r.suggested_deadline && r.status === "deadline_dispute" ? `<div class="deadline-box overdue-box">⚠️ Moliya boshqa sana taklif qildi: <b>${r.suggested_deadline}</b> — CEO hal qilishi kerak</div>` : ""}
        ${r.limit_amount ? `<div class="deadline-box">💰 AXO uchun limit: <b>${fmtMoney(r.limit_amount)}</b>${reportTotal(r) > r.limit_amount ? ` <span class="overdue">— hisobot limitdan ${fmtMoney(reportTotal(r) - r.limit_amount)} oshgan!</span>` : (reportTotal(r) ? ` <span class="ok-tag">✅ limit ichida</span>` : "")}</div>` : ""}
        ${r.description ? `<div class="detail-section"><h4>Izoh</h4><p>${esc(r.description)}</p>${photoHtml}</div>` : (photoHtml ? `<div class="detail-section">${photoHtml}</div>` : "")}
        ${reportsHtml ? `<div class="detail-section"><h4>Foto-hisobot</h4>${reportsHtml}</div>` : ""}
        <div class="detail-section">
            <h4>💬 Izohlar</h4>
            <div class="comments">${commentsHtml(r)}</div>
            <div class="comment-input">
                <input id="cmt-text" placeholder="Izoh yozing..." autocomplete="off" onkeydown="if(event.key==='Enter')sendComment(${r.id})">
                <button class="btn btn-primary btn-sm" onclick="sendComment(${r.id})">Yuborish</button>
            </div>
        </div>
        <div class="detail-section"><h4>Harakatlar tarixi</h4><ul class="timeline">${timeline}</ul></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="printRequest(${r.id})">🖨 Chop etish</button>
            ${actions}
        </div>
    `);
    window.__lastDetail = r;
}
function reportTotal(r) {
    return (r.reports || []).reduce((sum, rep) => sum + (Number(rep.total) || 0), 0);
}
function commentsHtml(r) {
    const cs = r.comments || [];
    if (!cs.length) return `<p class="muted">Hali izoh yo'q. Birinchi bo'lib yozing.</p>`;
    return cs.map((c) => `
        <div class="comment">
            <div class="cm-head">${esc(c.user)} <span class="muted">${c.role ? "· " + esc(c.role) : ""} · ${c.at}</span></div>
            <div class="cm-text">${esc(c.text)}</div>
        </div>`).join("");
}
async function sendComment(id) {
    const el = $("#cmt-text");
    const text = el.value.trim();
    if (!text) return;
    const { ok, data } = await api(`/api/requests/${id}/comment`, "POST", { text });
    if (ok) { openDetail(id); }
    else alert((data && data.error) || "Xatolik");
}

function doApprove(id, setsDeadline, setsLimit) {
    const today = new Date().toISOString().slice(0, 10);
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Tasdiqlash</h3>
        ${setsDeadline ? `<div class="field"><label>📅 Bajarilish muddati (dedline)</label><input type="date" id="ap-deadline" min="${today}" value="${today}"></div>
            <p class="muted">Muddatni belgilang. Keyingi bosqichda moliya bu sanani tasdiqlaydi yoki o'zgartirishni so'raydi.</p>` : ""}
        ${setsLimit ? `<div class="field"><label>💰 AXO uchun xarajat limiti (so'm, ixtiyoriy)</label><input type="number" id="ap-limit" min="0" placeholder="Masalan: 1000000" autocomplete="off"></div>
            <p class="muted">AXO bu summadan oshib xarajat qilsa, hisobotda ogohlantirish chiqadi.</p>` : ""}
        <div class="field"><label>Izoh (ixtiyoriy)</label><textarea id="ap-comment" autocomplete="off" placeholder="Izoh"></textarea></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-green" onclick="confirmApprove(${id}, ${!!setsDeadline}, ${!!setsLimit})">Tasdiqlash</button>
        </div>`);
}
async function confirmApprove(id, setsDeadline, setsLimit) {
    const body = { comment: ($("#ap-comment") ? $("#ap-comment").value : "") };
    if (setsDeadline) {
        const dl = $("#ap-deadline").value;
        if (!dl) { alert("Iltimos, muddatni belgilang"); return; }
        body.deadline = dl;
    }
    if (setsLimit && $("#ap-limit") && $("#ap-limit").value) body.limit = parseFloat($("#ap-limit").value);
    const { ok, data } = await api(`/api/requests/${id}/approve`, "POST", body);
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}
// CEO muddat nizosini hal qiladi
function openResolveDispute(id, suggested) {
    const today = new Date().toISOString().slice(0, 10);
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Muddat nizosi</h3>
        <p class="muted">Moliya boshqa sana taklif qildi: <b>${suggested || "—"}</b>. Shu sanani tasdiqlaysizmi yoki boshqa sana yuborasizmi?</p>
        <div class="field"><label>Yangi sana (o'zgartirmoqchi bo'lsangiz)</label><input type="date" id="rd-deadline" min="${today}" value="${suggested || today}"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-green" onclick="resolveDispute(${id}, true, ${JSON.stringify(suggested || "")})">✅ Taklif sanani tasdiqlash</button>
            <button class="btn btn-primary" onclick="resolveDispute(${id}, false)">📅 Bu sanani yuborish</button>
        </div>`);
}
async function resolveDispute(id, acceptSuggested, suggested) {
    const body = {};
    if (acceptSuggested) body.deadline = suggested;
    else body.deadline = $("#rd-deadline").value;
    const { ok, data } = await api(`/api/requests/${id}/resolve-dispute`, "POST", body);
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}
function openDeadlineChange(id, currentDeadline) {
    const today = new Date().toISOString().slice(0, 10);
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Sanani o'zgartirishni so'rash</h3>
        <p class="muted">Joriy muddat: <b>${currentDeadline || "—"}</b>. So'rov CEO ga yuboriladi, CEO yangi sanani belgilaydi.</p>
        <div class="field"><label>Taklif qilinayotgan yangi sana</label><input type="date" id="dl-suggested" min="${today}"></div>
        <div class="field"><label>Sabab</label><textarea id="dl-reason" placeholder="Nega muddat o'zgarishi kerak?"></textarea></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="submitDeadlineChange(${id})">CEO ga yuborish</button>
        </div>`);
}
async function submitDeadlineChange(id) {
    const { ok, data } = await api(`/api/requests/${id}/deadline-change`, "POST", {
        suggested_deadline: $("#dl-suggested").value,
        comment: $("#dl-reason").value,
    });
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}
async function doReject(id) {
    const comment = prompt("Rad etish sababi:");
    if (comment === null) return;
    const { ok, data } = await api(`/api/requests/${id}/reject`, "POST", { comment });
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}
async function doReopen(id) {
    if (!confirm("Bu zayavkaga qayta imkon berasizmi? (qaytadan ko'rib chiqiladi)")) return;
    const { ok, data } = await api(`/api/requests/${id}/reopen`, "POST", { comment: "" });
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}
function openSendToHr(id) {
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>HR ga yo'naltirish</h3>
        <p class="muted">Qayta imkon berilmadi. Masala HR (kadrlar) bo'limiga yuboriladi — masalan, xarajat oylikdan kesilishi mumkin.</p>
        <div class="field"><label>HR uchun izoh</label><textarea id="hr-note" placeholder="Masalan: ehtiyotsizlik tufayli zarar, oylikdan kesilsin"></textarea></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-red" onclick="submitToHr(${id})">HR ga yuborish</button>
        </div>`);
}
async function submitToHr(id) {
    const { ok, data } = await api(`/api/requests/${id}/to-hr`, "POST", { comment: $("#hr-note").value });
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}
async function doHrResolve(id) {
    const comment = prompt("HR yakuniy izohi (masalan: 200 000 so'm oylikdan kesildi):") || "";
    const { ok, data } = await api(`/api/requests/${id}/hr-resolve`, "POST", { comment });
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}

// ---------------- REPORT FORM ----------------
function categoryOptionsHtml() {
    // Zayavka turiga mos bo'limlar
    let groupNames = META_TYPE_GROUPS[REPORT_TYPE] || Object.keys(META_GROUPS);
    if (!groupNames.length) groupNames = Object.keys(META_GROUPS);
    let html = "";
    groupNames.forEach((g) => {
        const cats = META_GROUPS[g] || [];
        if (!cats.length) return;
        html += `<optgroup label="${esc(g)}">` +
            cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("") +
            `</optgroup>`;
    });
    return html || CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
}
function openReportForm(id, type) {
    REPORT_TYPE = type || "maintenance";
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Foto-hisobot topshirish</h3>
        <p class="muted">Bajarilgan ish, narxlar va rasmlarni kiriting.</p>
        <div class="field"><label>Izoh / bajarilgan ish</label><textarea id="rep-note" placeholder="Masalan: Pech ta'mirlandi, yangi qism o'rnatildi"></textarea></div>
        <div class="field">
            <label>Nima olindi va qancha sarflandi?</label>
            <p class="muted" style="margin:-2px 0 8px">Har bir xarid uchun: rasxod turi, nomi, soni va narxini yozing.</p>
            <div class="item-row item-head"><span>Rasxod turi</span><span>Nomi</span><span>Soni</span><span>Narxi (so'm)</span><span></span></div>
            <div id="items-container"></div>
            <button class="link-btn" onclick="addItemRow()">+ Yana qo'shish</button>
        </div>
        <div class="field"><label>Rasmlar (bir nechta tanlash mumkin)</label><input type="file" id="rep-photos" accept="image/*" multiple></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-green" onclick="submitReport(${id})">Topshirish</button>
        </div>
    `);
    addItemRow();
}
function addItemRow() {
    const div = document.createElement("div");
    div.className = "item-row";
    div.innerHTML = `
        <select class="it-cat">${categoryOptionsHtml()}</select>
        <input placeholder="Masalan: Qizdirgich" class="it-name" autocomplete="off">
        <input type="number" placeholder="1" class="it-qty" value="1" min="0">
        <input type="number" placeholder="0" class="it-price" min="0">
        <button class="link-btn" onclick="this.parentElement.remove()">✕</button>`;
    $("#items-container").appendChild(div);
}
async function submitReport(id) {
    const items = [...document.querySelectorAll("#items-container .item-row")].map((row) => ({
        category: row.querySelector(".it-cat").value,
        name: row.querySelector(".it-name").value.trim(),
        qty: parseFloat(row.querySelector(".it-qty").value) || 0,
        price: parseFloat(row.querySelector(".it-price").value) || 0,
    })).filter((i) => i.name);
    const files = [...$("#rep-photos").files];
    const photos = [];
    for (const f of files) photos.push(await fileToDataUrl(f));
    const { ok, data } = await api(`/api/requests/${id}/report`, "POST", {
        note: $("#rep-note").value, items, photos,
    });
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}

// ---------------- NEW REQUEST ----------------
$("#new-maintenance-btn").onclick = () => openNewForm("maintenance");
$("#new-branch-btn").onclick = () => openNewForm("new_branch");

async function openNewForm(type) {
    let branchField = "";
    if (type === "new_branch" || ME.role === "admin") {
        const { data: branches } = await api("/api/branches");
        branchField = `<div class="field"><label>Filial ${type === "new_branch" ? "(yangi yo'nalish)" : ""}</label>
            <select id="req-branch"><option value="">— tanlanmagan —</option>
            ${(branches || []).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></div>`;
    }
    const title = type === "new_branch" ? "Yangi filial so'rovi" : "Yangi texnik zayavka";
    const titlePh = type === "new_branch" ? "Masalan: Sergeli-2 filialini ochish" : "Masalan: Pechim buzildi";
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>${title}</h3>
        <div class="field"><label>Sarlavha</label><input id="req-title" autocomplete="off" placeholder="${titlePh}"></div>
        <div class="field"><label>Batafsil izoh</label><textarea id="req-desc" autocomplete="off" placeholder="Muammo yoki so'rov tafsilotlari"></textarea></div>
        ${branchField}
        <div class="field"><label>Rasm (ixtiyoriy)</label><input type="file" id="req-photo" accept="image/*"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="submitNew('${type}')">Yuborish</button>
        </div>
    `);
}
async function submitNew(type) {
    const title = $("#req-title").value.trim();
    if (!title) { alert("Sarlavhani kiriting"); return; }
    let photo = null;
    const pf = $("#req-photo").files[0];
    if (pf) photo = await fileToDataUrl(pf);
    const branchEl = $("#req-branch");
    const body = { type, title, description: $("#req-desc").value, photo };
    if (branchEl && branchEl.value) body.branch_id = parseInt(branchEl.value);
    const { ok, data } = await api("/api/requests", "POST", body);
    if (ok) { closeModal(); refreshCurrentView(); }
    else alert((data && data.error) || "Xatolik");
}

// ---------------- DASHBOARD ----------------
async function loadDashboard() {
    const [{ data: reqs }, { data: s }] = await Promise.all([api("/api/requests"), api("/api/stats")]);
    const items = reqs || [];
    const mine = items.filter((r) => r.needs_my_action);
    const active = items.filter((r) => !["closed", "rejected"].includes(r.status));
    const greet = LANG === "ru" ? "Здравствуйте" : "Assalomu alaykum";
    const c = $("#dashboard-content");

    const mineList = mine.length ? mine.slice(0, 6).map((r) => `
        <div class="dash-item" onclick="openDetail(${r.id})">
            <span class="type-tag type-${r.type}">${r.type === "new_branch" ? "🏗" : "🔧"}</span>
            <div class="di-main"><div class="di-title">${esc(r.title)}</div>
                <div class="di-meta">${r.branch ? "📍 " + esc(r.branch) + " · " : ""}${r.status_label}</div></div>
            <span class="status s-${r.status}">${r.status_label}</span>
        </div>`).join("") : `<p class="muted">${LANG === "ru" ? "Действий не требуется ✅" : "Harakat talab qilinmaydi ✅"}</p>`;

    const recent = active.filter((r) => !r.needs_my_action).slice(0, 6).map((r) => `
        <div class="dash-item" onclick="openDetail(${r.id})">
            <div class="di-main"><div class="di-title">#${r.id} ${esc(r.title)}</div>
                <div class="di-meta">${esc(r.created_by)} · ${r.created_at}${r.deadline ? " · 📅 " + r.deadline : ""}</div></div>
            <span class="status s-${r.status}">${r.status_label}</span>
        </div>`).join("") || `<p class="muted">${t("no_data")}</p>`;

    c.innerHTML = `
        <div class="dash-greet">${greet}, <b>${esc(ME.full_name)}</b> · <span class="muted">${esc(ME.role_label)}</span></div>
        <div class="stat-cards">
            <div class="stat-card"><div class="stat-num">${s ? s.total : 0}</div><div class="stat-lbl">${t("total_requests")}</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--amber)">${s ? s.active : 0}</div><div class="stat-lbl">${t("active")}</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--primary)">${mine.length}</div><div class="stat-lbl">${t("need_action")}</div></div>
            <div class="stat-card wide"><div class="stat-num" style="font-size:24px">${fmtMoney(s ? s.total_spend : 0)}</div><div class="stat-lbl">${t("total_spend")}</div></div>
        </div>
        <div class="dash-cols">
            <div class="settings-panel">
                <h3 class="panel-title">⚡ ${t("need_action")} ${mine.length ? `<span class="nav-badge">${mine.length}</span>` : ""}</h3>
                <div class="dash-list">${mineList}</div>
            </div>
            <div class="settings-panel">
                <h3 class="panel-title">🕓 ${t("quick")}</h3>
                <div class="dash-list">${recent}</div>
            </div>
        </div>`;
}

// ---------------- STATS ----------------
async function loadStats() {
    const { data: s } = await api("/api/stats");
    if (!s || s.error) return;
    const maxSpend = Math.max(1, ...s.branches.map((b) => b.spend));
    const barColors = ["#4f7cff", "#2fbf71", "#f5a623", "#a855f7", "#e5484d"];
    $("#stats-content").innerHTML = `
        <div class="export-row">
            <a class="btn btn-ghost btn-sm" href="/api/export/expenses.csv" download>⬇️ Excel — xarajatlar</a>
            <a class="btn btn-ghost btn-sm" href="/api/export/requests.csv" download>⬇️ Excel — zayavkalar</a>
            <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨 PDF / chop etish</button>
        </div>
        <div class="stat-cards">
            <div class="stat-card"><div class="stat-num">${s.total}</div><div class="stat-lbl">Jami zayavka</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--amber)">${s.active}</div><div class="stat-lbl">Faol</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--green)">${s.closed}</div><div class="stat-lbl">Yopilgan</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--red)">${s.rejected}</div><div class="stat-lbl">Rad etilgan</div></div>
            <div class="stat-card wide"><div class="stat-num" style="font-size:24px">${fmtMoney(s.total_spend)}</div><div class="stat-lbl">Umumiy xarajat</div></div>
        </div>

        <div class="detail-section">
            <h4>Filiallar bo'yicha xarajat</h4>
            ${s.branches.length ? s.branches.map((b, i) => `
                <div class="bar-row">
                    <div class="bar-label">${esc(b.name)} <span class="muted">(${b.requests} ta)</span></div>
                    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(b.spend / maxSpend * 100)}%;background:${barColors[i % barColors.length]}"></div></div>
                    <div class="bar-val">${fmtMoney(b.spend)}</div>
                </div>`).join("") : `<p class="muted">Ma'lumot yo'q.</p>`}
        </div>

        <div class="detail-section">
            <h4>Rasxod turi bo'yicha xarajat</h4>
            ${(s.categories && s.categories.length) ? (() => {
                const maxc = Math.max(1, ...s.categories.map((c) => c.spend));
                return s.categories.map((c, i) => `
                    <div class="bar-row">
                        <div class="bar-label">${esc(c.name)}</div>
                        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c.spend / maxc * 100)}%;background:${barColors[i % barColors.length]}"></div></div>
                        <div class="bar-val">${fmtMoney(c.spend)}</div>
                    </div>`).join("");
            })() : `<p class="muted">Hali xarajat kiritilmagan.</p>`}
        </div>

        <div class="detail-section">
            <h4>Holat bo'yicha taqsimot</h4>
            <div class="status-grid">
                ${Object.entries(s.status_counts).map(([k, v]) => `
                    <div class="status-pill"><span class="status s-${k}">${s.status_labels[k] || k}</span><b>${v}</b></div>`).join("")}
            </div>
        </div>

        <div class="detail-section">
            <h4>Tur bo'yicha</h4>
            <div class="status-grid">
                <div class="status-pill"><span class="type-tag type-maintenance">Texnik zayavka</span><b>${s.type_counts.maintenance || 0}</b></div>
                <div class="status-pill"><span class="type-tag type-new_branch">Yangi filial</span><b>${s.type_counts.new_branch || 0}</b></div>
            </div>
        </div>`;
}

// ---------------- ADMIN ----------------
let ROLE_MAP = {};
async function loadAdmin() {
    const [{ data: ud }, { data: branches }] = await Promise.all([api("/api/users"), api("/api/branches")]);
    if (!ud || ud.error) { $("#admin-content").innerHTML = `<p class="muted">Ruxsat yo'q.</p>`; return; }
    ROLE_MAP = ud.roles;
    const usersRows = ud.users.map((u) => `
        <tr>
            <td>${esc(u.full_name)}</td>
            <td><code>${esc(u.username)}</code></td>
            <td>${esc(u.role_label)}</td>
            <td>${u.branch ? esc(u.branch) : "—"}</td>
            <td>
                <button class="link-btn" onclick="changePassword(${u.id})">Parol</button>
                ${u.username === "admin" ? "" : `<button class="link-btn" style="color:var(--red)" onclick="deleteUser(${u.id})">O'chirish</button>`}
            </td>
        </tr>`).join("");
    const canActivate = ME.role === "ceo" || ME.role === "admin" || ME.role === "oper";
    const active = (branches || []).filter((b) => b.status !== "construction");
    const construction = (branches || []).filter((b) => b.status === "construction");
    const branchCard = (b) => `
        <div class="branch-card ${b.status === "construction" ? "bc-construction" : "bc-active"}">
            <div class="bc-name">${esc(b.name)}</div>
            <div class="bc-status">${b.status === "construction" ? "🏗 Qurilish jarayonida" : "🟢 Faol (savdoda)"}</div>
            <div class="bc-actions">
                ${b.status === "construction" && canActivate ? `<button class="btn btn-green btn-sm" onclick="activateBranch(${b.id})">✅ Qurilish tugadi</button>` : ""}
                <button class="link-btn" style="color:var(--red)" onclick="deleteBranch(${b.id})">O'chirish</button>
            </div>
        </div>`;

    $("#admin-content").innerHTML = `
        <div class="settings-grid">
            <div class="settings-panel">
                <div class="admin-head"><h3 class="panel-title">👥 Foydalanuvchilar</h3><button class="btn btn-primary btn-sm" onclick="openUserForm()">+ Foydalanuvchi</button></div>
                <div class="table-wrap">
                <table class="items-table">
                    <tr><th>Ism</th><th>Login</th><th>Rol</th><th>Filial</th><th></th></tr>
                    ${usersRows}
                </table>
                </div>
            </div>

            <div class="settings-panel">
                <div class="admin-head"><h3 class="panel-title">🟢 Faol filiallar (savdoda)</h3><button class="btn btn-primary btn-sm" onclick="openBranchForm()">+ Filial</button></div>
                <div class="branch-grid">${active.map(branchCard).join("") || '<p class="muted">Faol filial yo\'q.</p>'}</div>
            </div>

            <div class="settings-panel">
                <h3 class="panel-title">🏗 Qurilish jarayonidagi filiallar</h3>
                <p class="muted" style="margin-bottom:10px">Qurilish tugaganini tasdiqlasangiz, filial faol (savdodagi) ro'yxatga o'tadi.</p>
                <div class="branch-grid">${construction.map(branchCard).join("") || '<p class="muted">Qurilishdagi filial yo\'q.</p>'}</div>
            </div>
        </div>`;
}

async function openUserForm() {
    const { data: branches } = await api("/api/branches");
    const roleOpts = Object.entries(ROLE_MAP).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
    const branchOpts = (branches || []).map((b) => `<option value="${b.id}">${esc(b.name)}${b.status === "construction" ? " (qurilishda)" : ""}</option>`).join("");
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Yangi foydalanuvchi</h3>
        <div class="field"><label>To'liq ism</label><input id="u-name" autocomplete="off" placeholder="Masalan: Aziz Karimov"></div>
        <div class="field"><label>Login</label><input id="u-username" autocomplete="off" placeholder="login"></div>
        <div class="field"><label>Parol</label><input id="u-password" autocomplete="new-password" placeholder="parol"></div>
        <div class="field"><label>Rol</label><select id="u-role">${roleOpts}</select></div>
        <div class="field"><label>Filial</label>
            <select id="u-branch">
                <option value="all">— Barcha filiallar (vse) —</option>
                ${branchOpts}
            </select>
            <p class="muted" style="margin-top:4px">Filial menejeri uchun bitta filial tanlang. Regional menejer / boshqaruv uchun "Barcha filiallar".</p>
        </div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="submitUser()">💾 Saqlash</button>
        </div>`);
}
function openBranchForm() {
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Yangi filial</h3>
        <div class="field"><label>Filial nomi</label><input id="b-name" autocomplete="off" placeholder="Masalan: Olmazor"></div>
        <div class="field"><label>Holati</label>
            <select id="b-status">
                <option value="active">🟢 Faol (savdoda)</option>
                <option value="construction">🏗 Qurilish jarayonida</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="submitBranch()">💾 Saqlash</button>
        </div>`);
}
async function submitBranch() {
    const name = $("#b-name").value.trim();
    if (!name) { alert("Filial nomini kiriting"); return; }
    const { ok, data } = await api("/api/branches", "POST", { name, status: $("#b-status").value });
    if (ok) { closeModal(); loadAdmin(); }
    else alert((data && data.error) || "Xatolik");
}
async function activateBranch(id) {
    if (!confirm("Qurilish tugaganini tasdiqlaysizmi? Filial faol (savdodagi) ro'yxatga o'tadi.")) return;
    const { ok, data } = await api(`/api/branches/${id}/activate`, "POST", {});
    if (ok) loadAdmin();
    else alert((data && data.error) || "Xatolik");
}
async function submitUser() {
    const body = {
        full_name: $("#u-name").value.trim(),
        username: $("#u-username").value.trim(),
        password: $("#u-password").value,
        role: $("#u-role").value,
    };
    const br = $("#u-branch").value;
    body.branch_id = (br && br !== "all") ? parseInt(br) : null;
    const { ok, data } = await api("/api/users", "POST", body);
    if (ok) { closeModal(); loadAdmin(); }
    else alert((data && data.error) || "Xatolik");
}
async function changePassword(id) {
    const pw = prompt("Yangi parol:");
    if (!pw) return;
    const { ok, data } = await api(`/api/users/${id}/password`, "POST", { password: pw });
    if (ok) alert("Parol o'zgartirildi");
    else alert((data && data.error) || "Xatolik");
}
async function deleteUser(id) {
    if (!confirm("Foydalanuvchi o'chirilsinmi?")) return;
    const { ok, data } = await api(`/api/users/${id}/delete`, "POST");
    if (ok) loadAdmin();
    else alert((data && data.error) || "Xatolik");
}
async function deleteBranch(id) {
    if (!confirm("Filial o'chirilsinmi?")) return;
    const { ok, data } = await api(`/api/branches/${id}/delete`, "POST");
    if (ok) loadAdmin();
    else alert((data && data.error) || "Xatolik");
}

// ---------------- CHOP ETISH (bloknot/matn) ----------------
function buildRequestText(r) {
    const line = "=".repeat(48);
    const sub = "-".repeat(48);
    const L = [];
    L.push("AXO-OPEN group — ZAYAVKA #" + r.id);
    L.push(line);
    L.push("Tur:        " + (r.type === "new_branch" ? "Yangi filial so'rovi" : "Texnik zayavka"));
    L.push("Sarlavha:   " + r.title);
    if (r.branch) L.push("Filial:     " + r.branch);
    L.push("Yaratdi:    " + r.created_by + " (" + r.created_by_role + ")");
    L.push("Sana:       " + r.created_at);
    L.push("Holat:      " + r.status_label);
    if (r.deadline) L.push("Muddat:     " + r.deadline + (r.deadline_confirmed ? " (moliya tasdiqlagan)" : " (tasdiq kutilmoqda)"));
    if (r.limit_amount) L.push("AXO limiti: " + fmtMoney(r.limit_amount));
    if (r.description) { L.push(sub); L.push("IZOH:"); L.push(r.description); }
    (r.reports || []).forEach((rep, idx) => {
        L.push(sub);
        L.push("FOTO-HISOBOT #" + (idx + 1) + " — " + rep.by + " (" + rep.at + ")");
        if (rep.note) L.push("  " + rep.note);
        rep.items.forEach((i) => {
            L.push("  • [" + (i.category || "—") + "] " + i.name + " — " + i.qty + " x " + fmtMoney(i.price) + " = " + fmtMoney(i.qty * i.price));
        });
        L.push("  JAMI: " + fmtMoney(rep.total));
    });
    if ((r.comments || []).length) {
        L.push(sub);
        L.push("IZOHLAR:");
        r.comments.forEach((c) => { L.push("  " + c.at + " | " + c.user + ": " + c.text); });
    }
    L.push(sub);
    L.push("HARAKATLAR TARIXI:");
    (r.events || []).forEach((e) => {
        L.push("  - " + e.at + " | " + e.action + " — " + e.user + (e.role ? " (" + e.role + ")" : ""));
        if (e.comment) L.push("      \"" + e.comment + "\"");
    });
    L.push(line);
    L.push("Chop etilgan: " + new Date().toLocaleString());
    return L.join("\n");
}
function printRequest(id) {
    const r = window.__lastDetail;
    if (!r || r.id !== id) return;
    const text = buildRequestText(r);
    const w = window.open("", "_blank", "width=720,height=800");
    const esc2 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zayavka #${id}</title>
        <style>body{font-family:'Courier New',monospace;background:#fff;color:#000;margin:0;padding:20px}
        pre{white-space:pre-wrap;font-size:13px;line-height:1.5}
        .bar{position:fixed;top:0;left:0;right:0;background:#f0f0f0;padding:8px;text-align:right;border-bottom:1px solid #ccc}
        .bar button{margin-left:8px;padding:6px 14px;cursor:pointer;border:1px solid #888;border-radius:6px;background:#fff;font-weight:600}
        @media print{.bar{display:none}body{padding:0}}</style></head>
        <body><div class="bar">
        <button onclick="dl()">⬇️ .txt yuklab olish</button>
        <button onclick="window.print()">🖨 Chop etish</button></div>
        <div style="height:44px"></div><pre id="t">${esc2(text)}</pre>
        <script>
        function dl(){var b=new Blob([document.getElementById('t').textContent],{type:'text/plain;charset=utf-8'});
        var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='zayavka_${id}.txt';a.click();}
        <\/script></body></html>`);
    w.document.close();
}

// ---------------- MODAL helpers ----------------
function showModal(html) {
    $("#modal-root").innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
}
function closeModal() { $("#modal-root").innerHTML = ""; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---------------- PWA: service worker + o'rnatish ----------------
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
}
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    $("#install-btn").classList.remove("hidden");
});
$("#install-btn").onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $("#install-btn").classList.add("hidden");
};
window.addEventListener("appinstalled", () => { $("#install-btn").classList.add("hidden"); });

// ---------------- Pastki menyu (mobil) ----------------
$("#bn-menu").onclick = openDrawer;
$("#bn-add").onclick = () => {
    if (ME && (ME.role === "branch_manager" || ME.role === "admin")) openNewForm("maintenance");
    else if (ME && ME.role === "open_group") openNewForm("new_branch");
};
document.querySelectorAll("#bottom-nav .bn-item[data-view]").forEach((b) => {
    b.onclick = () => switchView(b.dataset.view, b.dataset.view === "requests" ? (b.dataset.type || "all") : undefined);
});

// init
buildSwatches();
applySettings();
checkAuth();
