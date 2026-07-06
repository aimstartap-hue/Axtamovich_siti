import { PRIORITY_LABELS, PRIORITY_COLOR, type Priority } from "@/lib/constants";

export default function PriorityBadge({ priority }: { priority: string | null }) {
  const p = (priority ?? "normal") as Priority;
  if (p === "normal") return null;
  return (
    <span className={`badge badge-${PRIORITY_COLOR[p]}`}>
      {p === "urgent" ? "🔴 " : ""}{PRIORITY_LABELS[p]}
    </span>
  );
}
