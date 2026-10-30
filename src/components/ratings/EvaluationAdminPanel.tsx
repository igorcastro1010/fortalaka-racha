"use client";

import { Star } from "lucide-react";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";
import { useEffect, useId, useRef, useState } from "react";
import { subscribeLiveRefresh } from '@/lib/live/refresh';
import { getEvaluationProgress, getEvaluationState, setRoundEvaluationsOpen, type EvaluationProgress, type EvaluationState } from "@/lib/ratings/repository";

export function EvaluationAdminPanel({ roundId, organizer, roundStatus, onOpenEvaluate, onUpdated, personalState, personalLoading = true, personalError = "" }: { roundId: string; organizer: boolean; roundStatus: string; onOpenEvaluate: (roundId: string) => void; onUpdated?: () => void; personalState?: EvaluationState | null; personalLoading?: boolean; personalError?: string }) {
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [loadedPersonal, setPersonal] = useState<EvaluationState | null>(null);
  const personal = personalState === undefined ? loadedPersonal : personalState;
  const sharedPersonal = personalState !== undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const readSequence = useRef(0);
  const busyRef = useRef(false);
  const [confirmation, setConfirmation] = useState<boolean | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmationId = useId();

  useEffect(() => {
    if (confirmation !== null) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [confirmation]);

  useEffect(() => {
    if (!organizer && sharedPersonal) return;
    let active = true;
    async function refresh() {
      if (busyRef.current) return;
      const currentRequest = ++readSequence.current;
      try {
        if (organizer) {
          const data = await getEvaluationProgress(roundId);
          if (active && currentRequest === readSequence.current) { setProgress(data); setError(""); }
        } else {
          const data = await getEvaluationState(roundId);
          if (active && currentRequest === readSequence.current) { setPersonal(data); setError(""); }
        }
      } catch (e) {
        console.error("Progresso de avaliações", e);
        if (active && currentRequest === readSequence.current) setError("Não foi possível carregar as avaliações. Tente novamente.");
      }
    }
    void refresh();
    const unsubscribe = subscribeLiveRefresh(refresh);
    return () => { active = false; unsubscribe(); };
  }, [roundId, roundStatus, organizer, sharedPersonal]);

  const open = organizer ? progress?.abertas : personal?.open;
  const completed = personal?.players.filter(player => player.avaliado).length ?? 0;

  async function toggle(open: boolean) {
    if (!organizer || busyRef.current || !progress || progress.abertas === open || (open && roundStatus !== "finalizado")) return;
    ++readSequence.current;
    busyRef.current = true;
    setConfirmation(null);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await setRoundEvaluationsOpen(roundId, open);
      setProgress(data);
      onUpdated?.();
      setMessage(open ? "Avaliacoes abertas." : "Avaliacoes fechadas.");
    } catch (e) {
      console.error("Alterar avaliações", e);
      setError("Não foi possível alterar as avaliações. Tente novamente.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return <section className="fk-panel min-w-0 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-xl font-black">Progresso da rodada</h3>
      </div>
      <span className={`shrink-0 px-2 py-1 text-xs font-bold uppercase ${open ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{open === undefined ? "Carregando" : open ? "ABERTA" : "FECHADA"}</span>
    </div>
    {organizer && progress ? <p className="text-base font-bold tabular-nums text-zinc-800">{progress.respondentes} de {progress.total} jogadores responderam</p> : !organizer && personal ? <p className="text-base font-bold tabular-nums text-zinc-800">{completed} de {personal.players.length} companheiros avaliados</p> : !organizer && personalError ? <p role="alert" className="text-sm text-red-700">{personalError}</p> : !organizer && !personalLoading ? <EmptyState title="Nenhuma avaliação disponível" description="O progresso aparece quando houver uma rodada disponível para avaliar." /> : !error && <LoadingCards label="Carregando progresso..." />}
    {(progress || personal) && <progress aria-label="Progresso das avaliações" value={organizer ? progress?.respondentes ?? 0 : completed} max={Math.max(1, organizer ? progress?.total ?? 0 : personal?.players.length ?? 0)} className="h-1.5 w-full accent-red-700" />}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {organizer && roundStatus !== "finalizado" && <EmptyState icon={Star} title="As avaliações ainda não estão abertas." description="Finalize pelo menos uma partida e encerre a rodada antes de abrir avaliações." />}
    {!organizer && open === false && <p className="text-sm font-bold text-zinc-600">Avaliações fechadas</p>}
    {!organizer && open === false && completed > 0 && <button onClick={() => onOpenEvaluate(roundId)} disabled={Boolean(error)} className="fk-secondary min-h-12 w-full rounded-lg border border-zinc-300 px-3 text-sm font-black disabled:opacity-50">VER MINHAS AVALIAÇÕES</button>}
    {!organizer && open && <button onClick={() => onOpenEvaluate(roundId)} disabled={Boolean(error)} className="fk-primary min-h-12 w-full rounded-lg bg-red-700 px-3 text-sm font-black text-white hover:bg-red-800 disabled:opacity-50">AVALIAR MEU TIME</button>}
    {organizer && <details className="border-t border-zinc-200 pt-2">
      <summary className="min-h-12 cursor-pointer content-center text-sm font-bold focus-visible:outline-2 focus-visible:outline-red-600">Gerenciar avaliações</summary>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button disabled={busy || !progress || progress.abertas || roundStatus !== "finalizado"} onClick={() => setConfirmation(true)} className="fk-primary min-h-12 rounded-lg bg-red-700 px-3 text-xs font-black uppercase text-white disabled:opacity-50">{busy && !open ? "Abrindo..." : "ABRIR AVALIAÇÕES"}</button>
        <button disabled={busy || !progress?.abertas} onClick={() => setConfirmation(false)} className="fk-secondary min-h-12 rounded-lg border border-zinc-300 px-3 text-xs font-black uppercase disabled:opacity-50">{busy && open ? "Fechando..." : "FECHAR AVALIAÇÕES"}</button>
      </div>
    </details>}
    {organizer && <dialog ref={dialogRef} aria-labelledby={`${confirmationId}-title`} aria-describedby={`${confirmationId}-description`} onCancel={() => setConfirmation(null)} onClose={() => setConfirmation(null)} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 backdrop:bg-black/40">
      <h3 id={`${confirmationId}-title`} className="text-lg font-black">{confirmation ? "Abrir avaliações?" : "Fechar avaliações?"}</h3>
      <p id={`${confirmationId}-description`} className="mt-3 text-sm text-zinc-600">{confirmation ? "Os jogadores que participaram das partidas finalizadas poderão avaliar seus companheiros." : "Os jogadores não poderão editar as notas depois do fechamento."}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" autoFocus onClick={() => setConfirmation(null)} className="fk-secondary min-h-12 rounded-lg border border-zinc-300 px-3 text-sm font-bold">Cancelar</button>
        <button type="button" disabled={busy || confirmation === null} onClick={() => { if (confirmation !== null) void toggle(confirmation); }} className="fk-primary min-h-12 rounded-lg bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-50">Confirmar</button>
      </div>
    </dialog>}
  </section>;
}
