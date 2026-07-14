// =============================================================================
// Sozlamalar UI primitivlari — premium enterprise ko'rinish (Stripe/Linear uslubi).
// Faqat prezentatsiya: guruh-konteyner, label+izoh+unit li input, switch, save.
// Server komponentlari (form action serverdan uzatiladi). Hech qanday logika yo'q.
// =============================================================================

const surface = { background: "var(--surface)", borderColor: "var(--border)" };

// --- Guruh konteyner: icon · title · description · divider · body · save ---
export function Group({
  icon, accent = "#2563eb", title, desc, action, save = "Saqlash", hiddenCb, footNote, children,
}: {
  icon: string; accent?: string; title: string; desc?: string;
  action?: (fd: FormData) => void | Promise<void>; save?: string; hiddenCb?: string; footNote?: string;
  children: React.ReactNode;
}) {
  const head = (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${accent}1f`, color: accent }}>{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {desc && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{desc}</p>}
      </div>
    </div>
  );
  const body = <div className="px-5 divide-y" style={{ borderColor: "var(--border)" }}>{children}</div>;
  const foot = action && (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface-2) 40%, transparent)" }}>
      <span className="text-[11px]" style={{ color: "var(--muted)" }}>{footNote ?? ""}</span>
      <button className="btn btn-brand !py-2 !px-5 text-sm shadow-sm">{save}</button>
    </div>
  );

  const cls = "rounded-2xl border overflow-hidden transition-shadow";
  const shadow = { boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 8px 24px -16px rgba(0,0,0,.4)" };
  if (action) {
    return (
      <form action={action} className={cls} style={{ ...surface, ...shadow }}>
        {hiddenCb && <input type="hidden" name="_cb" value={hiddenCb} />}
        {head}<div className="border-t" style={{ borderColor: "var(--border)" }} />{body}{foot}
      </form>
    );
  }
  return <div className={cls} style={{ ...surface, ...shadow }}>{head}<div className="border-t" style={{ borderColor: "var(--border)" }} />{body}</div>;
}

// --- Yozuv qatori (chapda label+izoh, o'ngda control) ---
function Row({ label, desc, children, right = true }: { label: string; desc?: string; children: React.ReactNode; right?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-6 py-4">
      <div className="sm:flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{desc}</div>}
      </div>
      <div className={`w-full sm:w-60 shrink-0 ${right ? "sm:flex sm:justify-end" : ""}`}>{children}</div>
    </div>
  );
}

// --- Raqamli input (o'ngda unit) ---
export function NumField({ name, label, desc, unit, defaultValue, placeholder }: { name: string; label: string; desc?: string; unit?: string; defaultValue?: string; placeholder?: string }) {
  return (
    <Row label={label} desc={desc}>
      <div className="relative w-full">
        <input name={name} type="number" defaultValue={defaultValue} placeholder={placeholder} className="input tabular-nums" style={unit ? { paddingRight: "3.25rem" } : undefined} />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--muted)" }}>{unit}</span>}
      </div>
    </Row>
  );
}

// --- Matnli input ---
export function TxtField({ name, label, desc, defaultValue, placeholder }: { name: string; label: string; desc?: string; defaultValue?: string; placeholder?: string }) {
  return (
    <Row label={label} desc={desc}>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="input" />
    </Row>
  );
}

// --- Select ---
export function SelField({ name, label, desc, defaultValue, options }: { name: string; label: string; desc?: string; defaultValue?: string; options: [string, string][] }) {
  return (
    <Row label={label} desc={desc}>
      <select name={name} defaultValue={defaultValue} className="select">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Row>
  );
}

// --- Textarea (label tepada, keng) ---
export function AreaField({ name, label, desc, defaultValue, placeholder, rows = 2 }: { name: string; label: string; desc?: string; defaultValue?: string; placeholder?: string; rows?: number }) {
  return (
    <div className="py-4">
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-xs mt-0.5 mb-2" style={{ color: "var(--muted)" }}>{desc}</div>}
      <textarea name={name} rows={rows} defaultValue={defaultValue} placeholder={placeholder} className="textarea mt-1.5" />
    </div>
  );
}

// --- Premium switch (toggle) ---
export function SwitchField({ name, label, desc, checked }: { name: string; label: string; desc?: string; checked: boolean }) {
  return (
    <Row label={label} desc={desc}>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" name={name} value="1" defaultChecked={checked} className="sr-only peer" />
        <span className="w-11 h-6 rounded-full transition-colors bg-surface-2 peer-checked:bg-brand border border-border peer-checked:border-brand" />
        <span className="pointer-events-none absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
      </label>
    </Row>
  );
}
