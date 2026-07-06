import type { Role } from "./constants";

export type RequestType = "maintenance" | "new_branch";

export interface Profile {
  id: string;
  org_id: string | null;
  full_name: string;
  role: Role;
  branch_id: number | null;
}

export interface Branch {
  id: number;
  org_id: string;
  name: string;
  status: "active" | "construction";
  regmen_id: string | null;
}

export interface RequestRow {
  id: number;
  org_id: string;
  type: RequestType;
  title: string;
  description: string | null;
  branch_id: number | null;
  created_by: string;
  status: string;
  deadline: string | null;
  deadline_confirmed: boolean;
  rejected_by: string | null;
  suggested_deadline: string | null;
  deadline_disputed: boolean;
  limit_amount: number | null;
  limit_type: "soft" | "hard" | null;
  photos_json: string[] | null;
  estimated_amount: number | null;
  estimated_currency: string | null;
  estimated_category: string | null;
  escalated: boolean;
  priority: "urgent" | "normal" | "low" | null;
  rating: number | null;
  executed_by: "axo" | "manager" | null;
  created_at: string;
}

export interface EventRow {
  id: number;
  request_id: number;
  user_id: string | null;
  action: string;
  comment: string | null;
  created_at: string;
}

export interface ReportItem {
  id?: number;
  name: string;
  category: string | null;
  supplier: string | null;
  qty: number;
  price: number;
}
