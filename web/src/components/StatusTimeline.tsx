import { RequestType } from "@/lib/types";

// Har bir tur uchun asosiy bosqichlar (soddalashtirilgan vizual)
const FLOWS: Record<RequestType, { key: string; label: string; match: string[] }[]> = {
  maintenance: [
    { key: "axo", label: "AXO", match: ["pending_axo"] },
    { key: "approve", label: "Tasdiq", match: ["pending_ceo", "pending_finance", "deadline_dispute"] },
    { key: "doing", label: "Bajarilmoqda", match: ["approved", "manager_doing"] },
    { key: "report", label: "Hisobot", match: ["axo_review", "report_submitted"] },
    { key: "done", label: "Yopildi", match: ["closed"] },
  ],
  new_branch: [
    { key: "axo", label: "AXO", match: ["pending_axo"] },
    { key: "ceo", label: "CEO", match: ["pending_ceo"] },
    { key: "fin", label: "Moliya", match: ["pending_finance", "deadline_dispute"] },
    { key: "doing", label: "Bajarilmoqda", match: ["funded"] },
    { key: "report", label: "Hisobot", match: ["report_submitted"] },
    { key: "done", label: "Yopildi", match: ["closed"] },
  ],
};

export default function StatusTimeline({ type, status }: { type: RequestType; status: string }) {
  const flow = FLOWS[type] ?? FLOWS.maintenance;
  if (status === "rejected") {
    return <div className="text-sm text-danger font-semibold">✕ Rad etildi</div>;
  }
  let current = flow.findIndex((s) => s.match.includes(status));
  if (current === -1) current = 0;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {flow.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? "bg-success text-white" : active ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${active ? "text-brand font-semibold" : "text-muted"}`}>
                {s.label}
              </span>
            </div>
            {i < flow.length - 1 && (
              <div className={`w-6 h-0.5 ${i < current ? "bg-success" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
