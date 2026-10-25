"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Confirmation = { title: string; description: string };

export function useConfirmation() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  const finish = useCallback((confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (request) dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [request]);

  useEffect(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);

  const confirm = useCallback((options: Confirmation): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => { pending.current = resolve; setRequest(options); });
  }, []);

  const confirmationDialog = request && <dialog ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); finish(false); }} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 backdrop:bg-black/40">
    <h3 id={`${id}-title`} className="break-words text-lg font-black">{request.title}</h3>
    <p id={`${id}-description`} className="mt-3 break-words text-sm text-zinc-600">{request.description}</p>
    <div className="mt-5 grid grid-cols-2 gap-2">
      <button type="button" autoFocus onClick={() => finish(false)} className="fk-secondary min-h-12 rounded-lg border border-zinc-300 px-3 text-sm font-bold">Cancelar</button>
      <button type="button" onClick={() => finish(true)} className="fk-primary min-h-12 rounded-lg bg-red-700 px-3 text-sm font-bold text-white">Confirmar</button>
    </div>
  </dialog>;

  return { confirm, confirmationDialog };
}
