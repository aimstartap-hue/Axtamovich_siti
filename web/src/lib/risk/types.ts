// =============================================================================
// AI Risk tizimi — kengaytiriladigan (extensible) arxitektura.
// Yangi qoida qo'shish = yangi RiskRule yozib RULES ro'yxatiga qo'shish. Sof
// funksiyalar (I/O yo'q) — test qilinadi. Har qoida real ma'lumotdan xulosa chiqaradi.
// =============================================================================

export type RiskLevel = "good" | "attention" | "risk" | "critical"; // 🟢 🟡 🟠 🔴

export interface RiskFinding {
  ruleId: string;      // "limit" | "price" | "repeat" | "docs" | ...
  level: RiskLevel;
  score: number;       // 0..100 ushbu topilmaning hissasi
  title: string;       // qisqa sarlavha
  detail: string;      // sabab (odam o'qiydigan tushuntirish)
}

export interface RiskResult {
  score: number;       // 0..100 umumiy risk ball
  level: RiskLevel;    // eng og'ir topilma darajasi
  findings: RiskFinding[];
  recommendation: string; // AI tavsiyasi
}

// Bir subyekt (lavozim yoki shaxs) uchun baholash konteksti
export interface Purchase { name: string; price: number; qty: number; at: string }
export interface RequestDoc { id: number; status: string; hasReport: boolean; hasPhotos: boolean }

export interface RiskContext {
  limit: number;                       // oylik limit
  spent: number;                       // shu oy sarflangan
  purchases: Purchase[];               // subyekt xaridlari (report_items)
  benchmarkMin: Map<string, number>;   // mahsulot (norm nom) -> eng arzon narx (butun tizim bo'yicha)
  requests: RequestDoc[];              // hujjat to'liqligi uchun
  now: Date;
}

// Bitta risk qoidasi — kontekstdan bitta topilma qaytaradi (yoki null).
export interface RiskRule {
  id: string;
  label: string; // filter/summary uchun ("Limit xavfi", "Narx xavfi"...)
  evaluate(ctx: RiskContext): RiskFinding | null;
}

export const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export const LEVEL_META: Record<RiskLevel, { dot: string; label: string; color: string }> = {
  good: { dot: "🟢", label: "Yaxshi", color: "#22c55e" },
  attention: { dot: "🟡", label: "Diqqat", color: "#fbbf24" },
  risk: { dot: "🟠", label: "Xavf", color: "#fb923c" },
  critical: { dot: "🔴", label: "Kritik", color: "#f87171" },
};
