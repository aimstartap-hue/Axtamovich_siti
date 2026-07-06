"use client";

import { useRouter, usePathname } from "next/navigation";

/** Oy tanlagich — o'zgartirilishi bilan darrov qo'llanadi. */
export default function MonthFilter({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <input
      type="month"
      defaultValue={month}
      className="input w-auto"
      onChange={(e) => router.replace(`${pathname}?month=${e.target.value}`)}
    />
  );
}
