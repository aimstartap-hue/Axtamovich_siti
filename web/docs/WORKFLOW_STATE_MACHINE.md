# Workflow State Machine — Spend Management (Open Group + AXO)

Bu — `src/lib/workflow-transitions.ts` dagi grafning vizual ko'rinishi. Kod bilan
1:1 mos (test `workflow-transitions.test.ts` buni tekshiradi).

## Diagramma

```mermaid
stateDiagram-v2
  [*] --> pending_axo
  pending_axo --> pending_ceo: AXO tasdiq (yirik / new_branch)
  pending_axo --> pending_finance: AXO tasdiq (kichik)
  pending_axo --> manager_doing: menejerga topshirish
  pending_axo --> rejected: rad
  pending_ceo --> pending_finance: CEO tasdiq
  pending_ceo --> rejected: rad
  pending_finance --> approved: Moliya tasdiq (ta'mir)
  pending_finance --> funded: Moliya tasdiq (ochilish)
  pending_finance --> deadline_dispute: muddat o'zgarish so'rovi
  pending_finance --> rejected: rad
  deadline_dispute --> pending_finance: CEO nizoni hal qildi
  approved --> report_submitted: foto-hisobot
  funded --> report_submitted: foto-hisobot
  manager_doing --> axo_review: menejer hisoboti
  axo_review --> report_submitted: AXO tekshirdi
  report_submitted --> closed: hisobot tasdiqlandi
  report_submitted --> rejected: rad
  rejected --> pending_axo: qayta ochish
  rejected --> hr_review: HR ga (oylikdan kesish)
  hr_review --> closed: HR yopdi
  closed --> [*]
```

## Audit topilmasi (actions.ts ↔ graf 1:1)

`actions.ts` dagi BARCHA status o'zgarishlari grafga mos (drift-test tasdiqlaydi), bitta nozik holat bilan:

- **CEO/admin favqulodda rad etish (override):** `rejectAction` guard'i `canApprove YOKI ceo/admin`
  bo'lgani uchun CEO/admin **jarayondagi** holatlardan ham (approved, funded, manager_doing,
  axo_review, deadline_dispute) rad eta oladi. Graf shu haqiqatni aks ettiradi (`→ rejected`).
- **⚠️ Ochiq xavf:** guard terminal holatni (closed) istisno qilmaydi — ya'ni CEO/admin
  texnik jihatdan **yopilgan** zayavkani ham rejected qila oladi. Bu grafga KIRITILMAGAN
  (noto'g'ri deb baholanadi). Tavsiya: deploy ochilgach `rejectAction` guard'ini
  `!isTerminal(status)` bilan cheklash (runtime o'zgarishi — hozir emas).

Boshqa barcha transition (approve/report/reopen/hr/dispute/delegate) graf bilan 100% mos.

## Business Lifecycle bilan moslik (gap analiz)

Universal Lifecycle (9 bosqich) ↔ hozirgi kod holatlari:

| Lifecycle bosqich | Hozirgi kod holati | Holat |
|---|---|---|
| Need | so'rov yaratish (pending_axo) | ✅ bor |
| Commitment | — | ⚠️ alohida yo'q (byudjet rezervi implitsit) |
| Approval | pending_axo → pending_ceo → pending_finance | ✅ bor (3 bosqichli) |
| Funding | approved / funded (limit/pul) | 🟡 qisman (Treasury alohida emas) |
| Execution | ijro (approved/funded) | ✅ bor |
| Evidence | foto-hisobot (report) | ✅ bor |
| Inspection | — | ⚠️ mustaqil qabul/QC yo'q |
| Settlement | hisobot tasdiqlash | 🟡 qisman (avans/to'lov reconciliation yo'q) |
| Closure | closed | ✅ bor |

**Xulosa:** kod Lifecycle'ning "yadro" oqimini (Need→Approval→Execution→Evidence→Closure)
qamraydi. **Yetishmayotgani:** Commitment (byudjet rezervi), Inspection (mustaqil qabul),
Settlement (avans/to'lov). Bular Blueprint bo'yicha keyingi bosqichlarda (Money/Procurement/
Advance modullari) qo'shiladi — hozirgi kodni buzmasdan, konfiguratsiya orqali.
