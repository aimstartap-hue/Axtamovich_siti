// =============================================================================
// AXO-OPEN group — o'zgarmas ma'lumotlar (Python server.py dan ko'chirilgan)
// =============================================================================

export type Role =
  | "admin" | "oper" | "branch_manager" | "regmen" | "axo"
  | "finance" | "ceo" | "ops_director" | "open_group" | "hr";

export const ROLES: Record<Role, string> = {
  admin: "Administrator",
  oper: "Operator (sozlamalar)",
  branch_manager: "Filial menejeri",
  regmen: "Regional menejer (Regmen)",
  axo: "AXO xodimi",
  finance: "Moliya",
  ceo: "CEO",
  ops_director: "Operatsion direktor",
  open_group: "Open group rahbari",
  hr: "HR (kadrlar)",
};

export const ADMIN_ROLES: Role[] = ["admin", "oper"];

// Rol guruhlari — sahifa/amal ko'rinishini nazorat qilish uchun YAGONA manba.
// (Kim nimani ko'radi — nazorat masalasi, shuning uchun bir joyda saqlanadi.)
export const FINANCE_ROLES: Role[] = ["admin", "oper", "ceo", "finance", "ops_director"];
export const OPENING_ROLES: Role[] = ["open_group", ...FINANCE_ROLES];
export const CEO_ROLES: Role[] = ["ceo", "admin", "ops_director"];

// Rol qobiliyatlari (admin yoqadi/o'chiradi)
export const PERMS: Record<string, string> = {
  create_maintenance: "Texnik zayavka yaratish",
  create_new_branch: "Yangi filial so'rovi yaratish",
  view_analytics: "Hisobot va analitikani ko'rish",
  manage_limits: "Limitlar bo'limini boshqarish",
  manage_settings: "Sozlamalar (admin) bo'limi",
  manage_ceo_threshold: "CEO summa chegarasini belgilash",
};

export const DEFAULT_PERMS: Record<string, Role[]> = {
  create_maintenance: ["branch_manager", "axo", "regmen", "open_group", "admin"],
  create_new_branch: ["open_group", "admin"],
  view_analytics: ["admin", "oper", "ceo", "finance", "ops_director", "open_group", "regmen"],
  manage_limits: ["admin", "oper", "ceo", "finance"],
  manage_settings: ["admin", "oper"],
  manage_ceo_threshold: ["admin"],
};

// Status nomlari (UI uchun)
export const STATUS_LABELS: Record<string, string> = {
  pending_axo: "AXO tasdig'i kutilmoqda",
  pending_approval: "Tasdiq kutilmoqda",
  pending_ceo: "CEO tasdig'i kutilmoqda",
  pending_finance: "Moliya tasdig'i kutilmoqda",
  deadline_dispute: "CEO sanani ko'rib chiqmoqda",
  approved: "Tasdiqlandi (AXO korzinkasida)",
  manager_doing: "Menejer bajarmoqda",
  axo_review: "AXO hisobotni tekshirmoqda",
  report_submitted: "Hisobot topshirildi",
  closed: "Yopildi",
  rejected: "Rad etildi",
  hr_review: "HR ko'rib chiqmoqda (oylikdan kesish)",
  funded: "Moliyalashtirildi (ish jarayonida)",
};

// Prioritet (muhimlik)
export type Priority = "urgent" | "normal" | "low";
export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Shoshilinch",
  normal: "Oddiy",
  low: "Kam muhim",
};
export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "red",
  normal: "blue",
  low: "green",
};

// Status rangi (UI badge)
export const STATUS_COLOR: Record<string, string> = {
  pending_axo: "amber",
  pending_ceo: "amber",
  pending_finance: "amber",
  deadline_dispute: "orange",
  approved: "blue",
  funded: "blue",
  report_submitted: "violet",
  manager_doing: "blue",
  axo_review: "violet",
  closed: "green",
  rejected: "red",
  hr_review: "orange",
};

export const DEFAULT_CEO_THRESHOLD = 50_000_000;

// Rasxod (xarajat) turlari — bo'limlarga ajratilgan
export const EXPENSE_GROUPS: Record<string, string[]> = {
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
};

// Qaysi zayavka turida qaysi bo'limlar ko'rinadi
export const TYPE_GROUPS: Record<string, string[]> = {
  maintenance: ["АХО / Хозяйственные", "Капвложения / Оборудование"],
  new_branch: ["Открытие точки", "Капвложения / Оборудование"],
};

export const EXPENSE_CATEGORIES: string[] = Object.values(EXPENSE_GROUPS).flat();

export const REQUEST_TYPES: Record<string, string> = {
  maintenance: "Texnik zayavka",
  new_branch: "Yangi filial so'rovi",
};

// Ochilish bosqichlari (open group checklist — punkt 11)
export const OPENING_STAGES: { key: string; label: string }[] = [
  { key: "construction", label: "Qurilish / remont" },
  { key: "equipment", label: "Jihozlar o'rnatildi" },
  { key: "license", label: "Litsenziya / ruxsatlar" },
  { key: "staff", label: "Xodimlar yollandi" },
  { key: "launch", label: "Ochilish (ishga tushdi)" },
];
