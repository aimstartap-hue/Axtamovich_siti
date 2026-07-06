import { STATUS_LABELS, STATUS_COLOR } from "@/lib/constants";

export default function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "blue";
  return (
    <span className={`badge badge-${color}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
