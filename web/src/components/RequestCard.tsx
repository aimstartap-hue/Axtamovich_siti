import Link from "next/link";
import { REQUEST_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/workflow";
import { isAging } from "@/lib/helpers";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import type { RequestRow } from "@/lib/types";

/** Zayavka kartochkasi — dashboard va ro'yxatlarda ishlatiladi. */
export default function RequestCard({
  r, branchName, highlightNew,
}: {
  r: Pick<RequestRow, "id" | "type" | "title" | "status" | "created_at" | "deadline" | "priority">;
  branchName?: string | null;
  highlightNew?: boolean;
}) {
  const aging = isAging(r);
  return (
    <Link
      href={`/requests/${r.id}`}
      className={`card p-3 flex items-center gap-3 hover:bg-surface-2 transition ${
        aging ? "border-danger/50" : highlightNew ? "border-brand/50" : ""
      }`}
    >
      <div className="text-xs font-mono text-muted w-10 shrink-0">#{r.id}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{r.title}</div>
        <div className="text-xs text-muted flex flex-wrap items-center gap-x-2">
          <span>{REQUEST_TYPES[r.type]}</span>
          {branchName && <span>· {branchName}</span>}
          <span>· {formatDate(r.created_at)}</span>
          {aging && <span className="text-danger font-semibold">· kechikdi</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={r.status} />
        <PriorityBadge priority={r.priority} />
      </div>
    </Link>
  );
}
