"use client";

import { useRef } from "react";
import { addCommentAction } from "../actions";

export default function CommentBox({ requestId }: { requestId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={async (fd) => { await addCommentAction(fd); formRef.current?.reset(); }}
      className="flex gap-2">
      <input type="hidden" name="id" value={requestId} />
      <input name="text" className="input flex-1" placeholder="Izoh yozing…" required />
      <button className="btn btn-brand">Yuborish</button>
    </form>
  );
}
