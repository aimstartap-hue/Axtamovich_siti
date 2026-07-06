"use client";

import { useId } from "react";
import { formatNumber, parseNumber } from "@/lib/format";

/**
 * Pul/raqam kiritish maydoni — yozayotganda mingliklarni probel bilan ko'rsatadi
 * (10 000). Asl qiymatni `onValueChange` orqali RAQAM sifatida qaytaradi va
 * `name` bo'yicha yashirin inputга sof raqam yozadi (formalar uchun).
 */
export default function NumberInput({
  name, value, onValueChange, placeholder, className, required, id,
}: {
  name?: string;
  value: number | null;
  onValueChange: (n: number | null) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const display = value === null || value === undefined ? "" : formatNumber(value);

  return (
    <>
      <input
        id={id ?? autoId}
        inputMode="numeric"
        className={className ?? "input"}
        placeholder={placeholder}
        value={display}
        required={required}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          onValueChange(raw === "" ? null : parseNumber(raw));
        }}
      />
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </>
  );
}
