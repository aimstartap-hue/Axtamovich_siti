// =============================================================================
// Budjet moduli — generic policy qatlami (future-proof).
// Har budjet turi = BudgetPolicy (plugin). Hozircha faqat "position" (mansab)
// yoqilgan. Kelajakda Filial/Shaxs/Mahsulot/Kategoriya budjetlari yangi policy
// qo'shib yoqiladi — mavjud kodni buzmasdan.
//
// Fizik saqlash `limits` jadvali (scope+ref+amount). Policy `scopes` orqali qaysi
// yozuvlar shu turga tegishliligini belgilaydi.
// =============================================================================

export type BudgetType = "position" | "branch" | "person" | "product" | "category";

export interface BudgetPolicy {
  type: BudgetType;
  label: string;                 // "Mansab budjeti"
  enabled: boolean;              // yoqilganmi (hozircha faqat position)
  scopes: string[];              // limits.scope qiymatlari (masalan ["role","user"])
  subtitleFor: (scope: string) => string; // qator ostidagi izoh
}

// --- Yoqilgan budjet turlari (har biri alohida tab) ---
export const rolePolicy: BudgetPolicy = { type: "position", label: "Lavozim budjeti", enabled: true, scopes: ["role"], subtitleFor: () => "Lavozim" };
export const personPolicy: BudgetPolicy = { type: "person", label: "Shaxs budjeti", enabled: true, scopes: ["user"], subtitleFor: () => "Shaxs" };
export const branchPolicy: BudgetPolicy = { type: "branch", label: "Filial budjeti", enabled: true, scopes: ["branch"], subtitleFor: () => "Filial" };
export const categoryPolicy: BudgetPolicy = { type: "category", label: "Kategoriya budjeti", enabled: true, scopes: ["category"], subtitleFor: () => "Kategoriya" };

// Backward-compat alias (eski kod positionPolicy'ga murojaat qilsa buzilmasin)
export const positionPolicy = rolePolicy;

export const BUDGET_POLICIES: BudgetPolicy[] = [rolePolicy, personPolicy, branchPolicy, categoryPolicy];

export const enabledPolicies = (): BudgetPolicy[] => BUDGET_POLICIES.filter((p) => p.enabled);
export const enabledScopes = (): string[] => enabledPolicies().flatMap((p) => p.scopes);
export const policyForScope = (scope: string): BudgetPolicy | undefined => BUDGET_POLICIES.find((p) => p.scopes.includes(scope));
