"use client";

import { useState } from "react";
import { rateRequestAction } from "../actions";

export default function RatingBox({ requestId, current }: { requestId: number; current: number | null }) {
  const [hover, setHover] = useState(0);
  const [saved, setSaved] = useState(current);

  if (saved) {
    return (
      <div className="text-sm">
        Sizning bahoingiz: {"★".repeat(saved)}{"☆".repeat(5 - saved)}
      </div>
    );
  }

  return (
    <form action={async (fd) => { const r = Number(fd.get("rating")); setSaved(r); await rateRequestAction(fd); }}>
      <input type="hidden" name="id" value={requestId} />
      <div className="text-sm mb-1">Ish sifatini baholang:</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="submit" name="rating" value={n}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            className="text-2xl leading-none">
            {n <= hover ? "★" : "☆"}
          </button>
        ))}
      </div>
    </form>
  );
}
