// AXO-OPEN group — frontend
let ME = null;
let CURRENT_FILTER = "all";
let TYPE_FILTER = "all";       // all | maintenance | new_branch
let CURRENT_VIEW = "requests";
let CATEGORIES = [];
let META_GROUPS = {};
let META_TYPE_GROUPS = {};
let META_SUPPLIERS = [];
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
        dashboard: "Boshqaruv paneli", all_requests: "Zayavkalar",
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
        dashboard: "Панель управления", all_requests: "Заявки",
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
    if (typeof loadNotifications === "function" && ME) loadNotifications();  // bildirishnomani ham yangilash
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
    $("#new-maintenance-btn").classList.toggle("hidden", !ME.can_create_maintenance);
    $("#new-branch-btn").classList.toggle("hidden", !ME.can_create_new_branch);
    $("#menu-admin").classList.toggle("hidden", !isAdmin);
    $("#menu-budget").classList.toggle("hidden", !["finance", "ceo", "admin", "oper"].includes(ME.role));
    $("#menu-assets").classList.toggle("hidden", ME.role === "oper");
    $("#menu-recurring").classList.toggle("hidden", !["axo", "ceo", "admin", "oper"].includes(ME.role));
    $("#menu-suppliers").classList.toggle("hidden", !["axo", "finance", "ceo", "admin", "oper"].includes(ME.role));
    $("#bn-add").classList.toggle("hidden", !(ME.can_create_maintenance || ME.can_create_new_branch));
    applySettings();
    // rasxod turlari (bo'limlar bilan)
    const { data: meta } = await api("/api/meta");
    CATEGORIES = (meta && meta.categories) || [];
    META_GROUPS = (meta && meta.groups) || {};
    META_TYPE_GROUPS = (meta && meta.type_groups) || {};
    META_SUPPLIERS = (meta && meta.suppliers) || [];
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
    if (view === "budget") loadBudget();
    if (view === "assets") loadAssets();
    if (view === "recurring") loadRecurring();
    if (view === "suppliers") loadSuppliers();
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
$("#change-pw-btn").onclick = () => {
    $("#settings-pop").classList.add("hidden");
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>🔑 Parolni o'zgartirish</h3>
        <div class="field"><label>Joriy parol</label><input type="password" id="pw-old" autocomplete="off"></div>
        <div class="field"><label>Yangi parol</label><input type="password" id="pw-new" autocomplete="new-password"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="changeMyPassword()">Saqlash</button>
        </div>`);
};
async function changeMyPassword() {
    const { ok, data } = await api("/api/change-password", "POST", { old: $("#pw-old").value, new: $("#pw-new").value });
    if (ok) { closeModal(); alert("Parol o'zgartirildi ✅"); }
    else alert((data && data.error) || "Xatolik");
}
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

    const pendingStatuses = ["pending_axo", "pending_ceo", "pending_finance", "deadline_dispute"];
    const approvedStatuses = ["approved", "funded", "report_submitted", "closed"];
    if (CURRENT_FILTER === "mine") items = items.filter((r) => r.needs_my_action);
    if (CURRENT_FILTER === "active") items = items.filter((r) => !["closed", "rejected"].includes(r.status));
    if (CURRENT_FILTER === "pending") items = items.filter((r) => pendingStatuses.includes(r.status));
    if (CURRENT_FILTER === "approved") items = items.filter((r) => approvedStatuses.includes(r.status));
    if (CURRENT_FILTER === "rejected") items = items.filter((r) => ["rejected", "hr_review"].includes(r.status));
    if (CURRENT_FILTER === "closed") items = items.filter((r) => r.status === "closed");

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
    const escTag = r.escalated ? `<span class="action-tag" style="color:var(--red)">⚠️ Eskalatsiya</span>` : "";
    return `
    <div class="card ${r.needs_my_action ? "card-action" : ""}" data-id="${r.id}" data-type="${r.type}">
        <div class="card-head">
            <div>
                <span class="type-tag type-${r.type}">${typeLabel}</span> ${actionTag} ${escTag}
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
        else if (r.status === "pending_axo") approveLabel = "AXO: tasdiqlash + summa";
        else if (r.sets_deadline) approveLabel = "Tasdiqlash + muddat";
        else if (r.sets_limit) approveLabel = "Tasdiqlash (muddat + limit)";
        actions = `
            <button class="btn btn-green" onclick='doApprove(${r.id}, ${r.sets_deadline ? "true" : "false"}, ${r.sets_limit ? "true" : "false"}, ${r.sets_estimate ? "true" : "false"})'>${approveLabel}</button>
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
                <tr><th>Rasxod turi</th><th>Nomi</th><th>Yetkazib beruvchi</th><th>Soni</th><th>Narxi</th><th>Jami</th></tr>
                ${rep.items.map((i) => `<tr><td>${esc(i.category || "—")}</td><td>${esc(i.name)}</td><td>${esc(i.supplier || "—")}</td><td>${i.qty}</td><td>${fmtMoney(i.price)}</td><td>${fmtMoney(i.qty * i.price)}</td></tr>`).join("")}
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
        ${r.estimated_amount ? `<div class="deadline-box">💵 AXO taxminiy summasi: <b>${(Number(r.estimated_amount) || 0).toLocaleString("ru-RU")} ${esc(r.estimated_currency || "so'm")}</b></div>` : ""}
        ${r.limit_amount ? `<div class="deadline-box">💰 AXO uchun limit: <b>${fmtMoney(r.limit_amount)}</b>${reportTotal(r) > r.limit_amount ? ` <span class="overdue">— hisobot limitdan ${fmtMoney(reportTotal(r) - r.limit_amount)} oshgan!</span>` : (reportTotal(r) ? ` <span class="ok-tag">✅ limit ichida</span>` : "")}</div>` : ""}
        ${r.description ? `<div class="detail-section"><h4>Izoh</h4><p>${esc(r.description)}</p>${photoHtml}</div>` : (photoHtml ? `<div class="detail-section">${photoHtml}</div>` : "")}
        ${r.estimated_category ? `<div class="deadline-box">🏷 Rasxod turi: <b>${esc(r.estimated_category)}</b></div>` : ""}
        ${reportsHtml ? `<div class="detail-section"><h4>Foto-hisobot</h4>${reportsHtml}</div>` : ""}
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

async function doApprove(id, setsDeadline, setsLimit, setsEstimate) {
    // Muddat/limit/summa kerak bo'lmasa — bir bosishda, ortiqcha izoh so'ramasdan tasdiqlaydi
    if (!setsDeadline && !setsLimit && !setsEstimate) {
        const { ok, data } = await api(`/api/requests/${id}/approve`, "POST", {});
        if (ok) { closeModal(); refreshCurrentView(); }
        else alert((data && data.error) || "Xatolik");
        return;
    }
    const today = new Date().toISOString().slice(0, 10);
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Tasdiqlash</h3>
        ${setsEstimate ? `
            <div class="field"><label>1️⃣ 💵 Summa (narx)</label>
                <div style="display:flex;gap:8px">
                    <input type="number" id="ap-estimate" min="0" placeholder="Masalan: 500000" autocomplete="off" style="flex:1">
                    <select id="ap-currency" style="width:110px">
                        <option value="so'm">so'm</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                        <option value="RUB">RUB ₽</option>
                    </select>
                </div>
            </div>
            <div class="field"><label>2️⃣ 🏷 Rasxod turi</label>
                <select id="ap-category">${(function(){ REPORT_TYPE = "maintenance"; return categoryOptionsHtml(); })()}</select>
            </div>
            <div class="field"><label>3️⃣ ✍️ Izoh (ixtiyoriy)</label>
                <textarea id="ap-comment" autocomplete="off" placeholder="Qo'shimcha izoh (ixtiyoriy)"></textarea>
            </div>` : ""}
        ${setsDeadline ? `<div class="field"><label>📅 Bajarilish muddati (dedline)</label><input type="date" id="ap-deadline" min="${today}" value="${today}"></div>
            <p class="muted">Muddatni belgilang. Keyingi bosqichda moliya bu sanani tasdiqlaydi yoki o'zgartirishni so'raydi.</p>` : ""}
        ${setsLimit ? `<div class="field"><label>💰 AXO uchun xarajat limiti (so'm, ixtiyoriy)</label><input type="number" id="ap-limit" min="0" placeholder="Masalan: 1000000" autocomplete="off"></div>
            <p class="muted">AXO bu summadan oshib xarajat qilsa, hisobotda ogohlantirish chiqadi.</p>` : ""}
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-green" onclick="confirmApprove(${id}, ${!!setsDeadline}, ${!!setsLimit}, ${!!setsEstimate})">Tasdiqlash</button>
        </div>`);
}
async function confirmApprove(id, setsDeadline, setsLimit, setsEstimate) {
    const body = {};
    if (setsDeadline) {
        const dl = $("#ap-deadline").value;
        if (!dl) { alert("Iltimos, muddatni belgilang"); return; }
        body.deadline = dl;
    }
    if (setsLimit && $("#ap-limit") && $("#ap-limit").value) body.limit = parseFloat($("#ap-limit").value);
    if (setsEstimate) {
        if ($("#ap-estimate") && $("#ap-estimate").value) body.estimated = parseFloat($("#ap-estimate").value);
        body.currency = $("#ap-currency") ? $("#ap-currency").value : "so'm";
        body.category = $("#ap-category") ? $("#ap-category").value : "";
        body.comment = $("#ap-comment") ? $("#ap-comment").value : "";
    }
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
        <p class="muted">Moliya <b>${suggested || "—"}</b> sanani taklif qildi. Shu sanani qoldirib yoki o'zgartirib <b>Tasdiqlash</b>ni bosing. Sana yakuniy belgilanadi — moliyaga qayta so'rov yuborilmaydi.</p>
        <div class="field"><label>📅 Yakuniy sana</label><input type="date" id="rd-deadline" min="${today}" value="${suggested || today}"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-green" onclick="resolveDispute(${id})">✅ Tasdiqlash</button>
        </div>`);
}
async function resolveDispute(id) {
    const dl = $("#rd-deadline").value;
    if (!dl) { alert("Sanani belgilang"); return; }
    const { ok, data } = await api(`/api/requests/${id}/resolve-dispute`, "POST", { deadline: dl });
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
            <div class="item-row item-head"><span>Rasxod turi</span><span>Nomi</span><span>Yetkazib beruvchi</span><span>Soni</span><span>Narxi</span><span></span></div>
            <div id="items-container"></div>
            <button class="link-btn" onclick="addItemRow()">+ Yana qo'shish</button>
        </div>
        <div class="field"><label>Rasmlar (bir nechta tanlash mumkin)</label><input type="file" id="rep-photos" accept="image/*" multiple></div>
        <div class="report-total" id="rep-total">Umumiy summa: <b>0 so'm</b></div>
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
    const supOpts = `<option value="">—</option>` + (META_SUPPLIERS || []).map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    div.innerHTML = `
        <select class="it-cat">${categoryOptionsHtml()}</select>
        <input placeholder="Masalan: Qizdirgich" class="it-name" autocomplete="off">
        <select class="it-sup" title="Yetkazib beruvchi">${supOpts}</select>
        <input type="number" placeholder="1" class="it-qty" value="1" min="0" oninput="updateReportTotal()">
        <input type="number" placeholder="0" class="it-price" min="0" oninput="updateReportTotal()">
        <button class="link-btn" onclick="this.parentElement.remove(); updateReportTotal()">✕</button>`;
    $("#items-container").appendChild(div);
    updateReportTotal();
}
function updateReportTotal() {
    const el = $("#rep-total");
    if (!el) return;
    let total = 0;
    document.querySelectorAll("#items-container .item-row").forEach((row) => {
        total += (parseFloat(row.querySelector(".it-qty").value) || 0) * (parseFloat(row.querySelector(".it-price").value) || 0);
    });
    el.innerHTML = "Umumiy summa: <b>" + fmtMoney(total) + "</b>";
}
async function submitReport(id) {
    const items = [...document.querySelectorAll("#items-container .item-row")].map((row) => ({
        category: row.querySelector(".it-cat").value,
        name: row.querySelector(".it-name").value.trim(),
        supplier: row.querySelector(".it-sup") ? row.querySelector(".it-sup").value : "",
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
    if (type === "maintenance") {
        // Foydalanuvchining filial(lar)i; menejer 1 ta bo'lsa oldindan tanlangan
        const mine = ME.my_branches || [];
        const list = mine.length ? mine : (await api("/api/branches")).data || [];
        branchField = `<div class="field"><label>Qaysi filial uchun?</label>
            <select id="req-branch">${mine.length === 1 ? "" : `<option value="">— tanlang —</option>`}
            ${list.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></div>`;
    } else if (type === "new_branch") {
        branchField = `<div class="field"><label>Filial (ixtiyoriy, mavjud yo'nalish)</label>
            <select id="req-branch"><option value="">— tanlanmagan —</option>
            ${((await api("/api/branches")).data || []).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></div>`;
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
    const [{ data: s }, { data: k }] = await Promise.all([api("/api/stats"), api("/api/kpi")]);
    if (!s || s.error) return;
    const maxSpend = Math.max(1, ...s.branches.map((b) => b.spend));
    const barColors = ["#4f7cff", "#2fbf71", "#f5a623", "#a855f7", "#e5484d"];
    const kpiHtml = k && !k.error ? `
        <h4 style="margin-bottom:10px">📊 Asosiy ko'rsatkichlar (KPI)</h4>
        <div class="stat-cards">
            <div class="stat-card"><div class="stat-num">${k.avg_days}</div><div class="stat-lbl">O'rtacha hal qilish (kun)</div></div>
            <div class="stat-card"><div class="stat-num" style="color:${k.on_time_pct >= 70 ? "var(--green)" : "var(--amber)"}">${k.on_time_pct}%</div><div class="stat-lbl">Muddatida bajarilgan</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--green)">${k.closed_count}</div><div class="stat-lbl">Yopilgan (jami)</div></div>
            <div class="stat-card"><div class="stat-num" style="color:var(--red)">${k.overdue_now}</div><div class="stat-lbl">Hozir muddati o'tgan</div></div>
        </div>
        <div class="dash-cols" style="margin-top:14px">
            <div class="settings-panel">
                <h4>📈 Oylik zayavkalar</h4>
                ${k.trend.length ? (() => { const mx = Math.max(1, ...k.trend.map((x) => x.count)); return k.trend.map((x) => `
                    <div class="bar-row"><div class="bar-label">${x.month}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(x.count / mx * 100)}%;background:var(--primary)"></div></div>
                    <div class="bar-val">${x.count} ta</div></div>`).join(""); })() : `<p class="muted">${t("no_data")}</p>`}
            </div>
            <div class="settings-panel">
                <h4>🏆 Eng faol xodimlar</h4>
                ${k.top_performers.length ? k.top_performers.map((p, i) => `
                    <div class="dash-item"><span>${["🥇", "🥈", "🥉", "4", "5"][i]}</span><div class="di-main"><div class="di-title">${esc(p.name)}</div></div><b>${p.count} hisobot</b></div>`).join("") : `<p class="muted">${t("no_data")}</p>`}
            </div>
        </div>
        <div class="detail-section"></div>` : "";
    $("#stats-content").innerHTML = `
        ${kpiHtml}
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

// ---------------- BYUDJET ----------------
let BUDGET_MONTH = new Date().toISOString().slice(0, 7);
async function loadBudget() {
    const { data } = await api("/api/budgets?month=" + BUDGET_MONTH);
    if (!data || data.error) { $("#budget-content").innerHTML = `<p class="muted">Ruxsat yo'q.</p>`; return; }
    const rows = data.branches.map((b) => {
        const pct = b.budget > 0 ? Math.min(100, Math.round(b.spent / b.budget * 100)) : 0;
        const over = b.budget > 0 && b.spent > b.budget;
        return `
        <div class="budget-card">
            <div class="bc-top"><b>${esc(b.name)}</b>
                ${data.can_edit ? `<button class="link-btn" onclick="openBudgetForm(${b.branch_id}, '${esc(b.name)}', ${b.budget})">✏️ Byudjet</button>` : ""}</div>
            <div class="bar-track" style="margin:8px 0"><div class="bar-fill" style="width:${pct}%;background:${over ? "var(--red)" : "var(--green)"}"></div></div>
            <div class="info-row" style="justify-content:space-between">
                <span>Byudjet: <b>${fmtMoney(b.budget)}</b></span>
                <span>Sarflandi: <b>${fmtMoney(b.spent)}</b></span>
                <span class="${over ? "overdue" : "ok-tag"}">${over ? "Oshib ketdi: " + fmtMoney(-b.remaining) : "Qoldiq: " + fmtMoney(b.remaining)}</span>
            </div>
        </div>`;
    }).join("");
    $("#budget-content").innerHTML = `
        <div class="export-row">
            <label class="muted">Oy:</label>
            <input type="month" id="budget-month" value="${BUDGET_MONTH}" onchange="BUDGET_MONTH=this.value;loadBudget()">
        </div>
        <div class="budget-grid">${rows || `<p class="muted">${t("no_data")}</p>`}</div>`;
}
function openBudgetForm(branchId, name, current) {
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Byudjet — ${esc(name)}</h3>
        <p class="muted">Oy: ${BUDGET_MONTH}</p>
        <div class="field"><label>Oylik byudjet (so'm)</label><input type="number" id="bud-amount" min="0" value="${current || ""}" autocomplete="off"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="saveBudget(${branchId})">💾 Saqlash</button>
        </div>`);
}
async function saveBudget(branchId) {
    const { ok, data } = await api("/api/budgets", "POST", {
        branch_id: branchId, month: BUDGET_MONTH, amount: parseFloat($("#bud-amount").value) || 0,
    });
    if (ok) { closeModal(); loadBudget(); }
    else alert((data && data.error) || "Xatolik");
}

// ---------------- AKTIVLAR ----------------
async function loadAssets() {
    const [{ data }, { data: branches }] = await Promise.all([api("/api/assets"), api("/api/branches")]);
    if (!data || data.error) { $("#assets-content").innerHTML = `<p class="muted">Ruxsat yo'q.</p>`; return; }
    const today = new Date().toISOString().slice(0, 10);
    const rows = data.assets.map((a) => {
        const warnOut = a.warranty_until && a.warranty_until < today;
        return `<tr>
            <td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${esc(a.branch)}</td>
            <td>${esc(a.serial)}</td><td>${esc(a.purchase_date)}</td>
            <td class="${warnOut ? "overdue" : ""}">${esc(a.warranty_until)}${warnOut ? " ⚠️" : ""}</td>
            <td>${data.can_edit ? `<button class="link-btn" style="color:var(--red)" onclick="deleteAsset(${a.id})">O'chirish</button>` : ""}</td>
        </tr>`;
    }).join("");
    $("#assets-content").innerHTML = `
        ${data.can_edit ? `<div class="export-row"><button class="btn btn-primary btn-sm" onclick='openAssetForm(${JSON.stringify(branches || [])})'>+ Jihoz qo'shish</button></div>` : ""}
        <div class="table-wrap"><table class="items-table">
            <tr><th>Nomi</th><th>Turi</th><th>Filial</th><th>Seriya</th><th>Olingan</th><th>Kafolat</th><th></th></tr>
            ${rows || `<tr><td colspan="7" class="muted">Jihoz yo'q.</td></tr>`}
        </table></div>`;
}
function openAssetForm(branches) {
    const opts = (branches || []).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Yangi jihoz / aktiv</h3>
        <div class="field"><label>Nomi</label><input id="as-name" autocomplete="off" placeholder="Masalan: Sovutgich Liebherr"></div>
        <div class="field"><label>Turi</label><input id="as-cat" autocomplete="off" placeholder="Masalan: Холодильное оборудование"></div>
        <div class="field"><label>Filial</label><select id="as-branch"><option value="">—</option>${opts}</select></div>
        <div class="field"><label>Seriya raqami</label><input id="as-serial" autocomplete="off"></div>
        <div class="field"><label>Olingan sana</label><input type="date" id="as-pdate"></div>
        <div class="field"><label>Kafolat tugashi</label><input type="date" id="as-warranty"></div>
        <div class="field"><label>Izoh</label><input id="as-note" autocomplete="off"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="saveAsset()">💾 Saqlash</button>
        </div>`);
}
async function saveAsset() {
    const name = $("#as-name").value.trim();
    if (!name) { alert("Nom kiriting"); return; }
    const body = {
        name, category: $("#as-cat").value, serial: $("#as-serial").value,
        purchase_date: $("#as-pdate").value, warranty_until: $("#as-warranty").value, note: $("#as-note").value,
    };
    const bv = $("#as-branch").value;
    if (bv) body.branch_id = parseInt(bv);
    const { ok, data } = await api("/api/assets", "POST", body);
    if (ok) { closeModal(); loadAssets(); }
    else alert((data && data.error) || "Xatolik");
}
async function deleteAsset(id) {
    if (!confirm("Jihoz o'chirilsinmi?")) return;
    const { ok, data } = await api(`/api/assets/${id}/delete`, "POST", {});
    if (ok) loadAssets();
    else alert((data && data.error) || "Xatolik");
}

// ---------------- PROFILAKTIKA (takrorlanuvchi) ----------------
async function loadRecurring() {
    const [{ data }, { data: branches }] = await Promise.all([api("/api/recurring"), api("/api/branches")]);
    if (!data || data.error) { $("#recurring-content").innerHTML = `<p class="muted">Ruxsat yo'q.</p>`; return; }
    const rows = data.tasks.map((t) => `
        <tr>
            <td>${esc(t.title)}</td><td>${esc(t.branch)}</td><td>${esc(t.category)}</td>
            <td>har ${t.interval_days} kun</td><td>${esc(t.next_date)}</td>
            <td>${data.can_edit ? `<button class="link-btn" style="color:var(--red)" onclick="deleteRecurring(${t.id})">O'chirish</button>` : ""}</td>
        </tr>`).join("");
    $("#recurring-content").innerHTML = `
        <p class="muted" style="margin-bottom:12px">Belgilangan kun kelganda tizim avtomatik texnik zayavka ochadi (masalan: har oy ventilyatsiya tozalash).</p>
        ${data.can_edit ? `<div class="export-row"><button class="btn btn-primary btn-sm" onclick='openRecurringForm(${JSON.stringify(branches || [])})'>+ Profilaktik ish</button></div>` : ""}
        <div class="table-wrap"><table class="items-table">
            <tr><th>Ish</th><th>Filial</th><th>Turi</th><th>Davriylik</th><th>Keyingi sana</th><th></th></tr>
            ${rows || `<tr><td colspan="6" class="muted">Hozircha yo'q.</td></tr>`}
        </table></div>`;
}
function openRecurringForm(branches) {
    const opts = (branches || []).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
    const today = new Date().toISOString().slice(0, 10);
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Yangi profilaktik ish</h3>
        <div class="field"><label>Ish nomi</label><input id="rc-title" autocomplete="off" placeholder="Masalan: Ventilyatsiya filtrini tozalash"></div>
        <div class="field"><label>Izoh</label><input id="rc-desc" autocomplete="off"></div>
        <div class="field"><label>Filial</label><select id="rc-branch"><option value="">—</option>${opts}</select></div>
        <div class="field"><label>Davriylik (kun)</label><input type="number" id="rc-interval" value="30" min="1"></div>
        <div class="field"><label>Birinchi sana</label><input type="date" id="rc-next" value="${today}"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="saveRecurring()">💾 Saqlash</button>
        </div>`);
}
async function saveRecurring() {
    const title = $("#rc-title").value.trim();
    if (!title) { alert("Ish nomini kiriting"); return; }
    const body = { title, description: $("#rc-desc").value, interval_days: parseInt($("#rc-interval").value) || 30, next_date: $("#rc-next").value };
    const bv = $("#rc-branch").value; if (bv) body.branch_id = parseInt(bv);
    const { ok, data } = await api("/api/recurring", "POST", body);
    if (ok) { closeModal(); loadRecurring(); }
    else alert((data && data.error) || "Xatolik");
}
async function deleteRecurring(id) {
    if (!confirm("O'chirilsinmi?")) return;
    const { ok } = await api(`/api/recurring/${id}/delete`, "POST", {});
    if (ok) loadRecurring();
}

// ---------------- YETKAZIB BERUVCHILAR ----------------
async function loadSuppliers() {
    const { data } = await api("/api/suppliers");
    if (!data || data.error) { $("#suppliers-content").innerHTML = `<p class="muted">Ruxsat yo'q.</p>`; return; }
    const cards = data.suppliers.map((s) => `
        <div class="settings-panel">
            <div class="admin-head">
                <div><b style="font-size:16px">${esc(s.name)}</b> ${s.phone ? `<span class="muted">· 📞 ${esc(s.phone)}</span>` : ""}</div>
                <div>Jami: <b>${fmtMoney(s.total)}</b>${data.can_edit ? ` <button class="link-btn" style="color:var(--red)" onclick="deleteSupplier(${s.id})">✕</button>` : ""}</div>
            </div>
            ${s.note ? `<p class="muted">${esc(s.note)}</p>` : ""}
            ${s.history.length ? `<table class="items-table" style="margin-top:8px">
                <tr><th>Tovar</th><th>Soni</th><th>Narxi</th><th>Sana</th></tr>
                ${s.history.map((h) => `<tr><td>${esc(h.name)}</td><td>${h.qty}</td><td>${fmtMoney(h.price)}</td><td>${esc(h.at)}</td></tr>`).join("")}
            </table>` : `<p class="muted">Narx tarixi yo'q (hisobotlarda bu yetkazib beruvchi tanlanmagan).</p>`}
        </div>`).join("");
    $("#suppliers-content").innerHTML = `
        <p class="muted" style="margin-bottom:12px">AXO foto-hisobotda tovar yonida yetkazib beruvchini tanlasa, narx tarixi shu yerda yig'iladi.</p>
        ${data.can_edit ? `<div class="export-row"><button class="btn btn-primary btn-sm" onclick="openSupplierForm()">+ Yetkazib beruvchi</button></div>` : ""}
        <div class="settings-grid">${cards || `<p class="muted">${t("no_data")}</p>`}</div>`;
}
function openSupplierForm() {
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Yangi yetkazib beruvchi</h3>
        <div class="field"><label>Nomi</label><input id="sp-name" autocomplete="off" placeholder="Masalan: Metan-Servis MChJ"></div>
        <div class="field"><label>Telefon</label><input id="sp-phone" autocomplete="off"></div>
        <div class="field"><label>Izoh</label><input id="sp-note" autocomplete="off"></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="saveSupplier()">💾 Saqlash</button>
        </div>`);
}
async function saveSupplier() {
    const name = $("#sp-name").value.trim();
    if (!name) { alert("Nom kiriting"); return; }
    const { ok, data } = await api("/api/suppliers", "POST", { name, phone: $("#sp-phone").value, note: $("#sp-note").value });
    if (ok) { closeModal(); loadSuppliers(); META_SUPPLIERS = null; }
    else alert((data && data.error) || "Xatolik");
}
async function deleteSupplier(id) {
    if (!confirm("O'chirilsinmi?")) return;
    const { ok } = await api(`/api/suppliers/${id}/delete`, "POST", {});
    if (ok) loadSuppliers();
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
            <div class="bc-status">${b.status === "construction" ? "🏗 Qurilish jarayonida" : "🟢 Faol (savdoda)"}${b.regmen ? " · 👤 " + esc(b.regmen) : ""}</div>
            <div class="bc-actions">
                ${b.status === "construction" && canActivate ? `<button class="btn btn-green btn-sm" onclick="activateBranch(${b.id})">✅ Qurildi — tasdiqlash</button>` : ""}
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
                <div class="admin-head"><h3 class="panel-title">🏗 Qurilayotgan (yangi) filiallar</h3><button class="btn btn-primary btn-sm" onclick="openBranchForm()">+ Filial</button></div>
                <p class="muted" style="margin-bottom:10px">Hozircha qurilish jarayonida. Qurib bo'lingach, admin/CEO <b>tasdiqlasa</b> — pastdagi "Qurilgan" ro'yxatiga o'tadi.</p>
                <div class="branch-grid">${construction.map(branchCard).join("") || '<p class="muted">Qurilayotgan filial yo\'q.</p>'}</div>
            </div>

            <div class="settings-panel">
                <h3 class="panel-title">✅ Qurilgan (faol, savdodagi) filiallar</h3>
                <div class="branch-grid">${active.map(branchCard).join("") || '<p class="muted">Qurilgan filial yo\'q.</p>'}</div>
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
async function openBranchForm() {
    const { data: ud } = await api("/api/users");
    const regmens = ((ud && ud.users) || []).filter((u) => u.role === "regmen");
    const regOpts = regmens.map((r) => `<option value="${r.id}">${esc(r.full_name)}</option>`).join("");
    showModal(`
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3>Yangi filial</h3>
        <div class="field"><label>Filial nomi</label><input id="b-name" autocomplete="off" placeholder="Masalan: Zahratun fast-food (... filiali)"></div>
        <div class="field"><label>Holati</label>
            <select id="b-status">
                <option value="active">🟢 Faol / qurilgan (savdoda)</option>
                <option value="construction">🏗 Qurilish jarayonida (yangi)</option>
            </select>
        </div>
        <div class="field"><label>Regional menejer (Regmen)</label>
            <select id="b-regmen"><option value="">— tanlanmagan —</option>${regOpts}</select></div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
            <button class="btn btn-primary" onclick="submitBranch()">💾 Saqlash</button>
        </div>`);
}
async function submitBranch() {
    const name = $("#b-name").value.trim();
    if (!name) { alert("Filial nomini kiriting"); return; }
    const body = { name, status: $("#b-status").value };
    const rg = $("#b-regmen").value; if (rg) body.regmen_id = parseInt(rg);
    const { ok, data } = await api("/api/branches", "POST", body);
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
            L.push("  • [" + (i.category || "—") + "] " + i.name + (i.supplier ? " (" + i.supplier + ")" : "") + " — " + i.qty + " x " + fmtMoney(i.price) + " = " + fmtMoney(i.qty * i.price));
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
