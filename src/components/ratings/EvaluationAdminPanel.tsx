"use client";

import { useEffect, useRef, useState } from "react";
import { getEvaluationProgress, getEvaluationState, setRoundEvaluationsOpen, type EvaluationProgress, type EvaluationState } from "@/lib/ratings/repository";

export function EvaluationAdminPanel({ roundId, organizer, roundStatus, onOpenEvaluate }: { roundId: string; organizer: boolean; roundStatus: string; onOpenEvaluate: (roundId: string) => void }) {
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [personal, setPersonal] = useState<EvaluationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const readSequence = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
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
        if (active && currentRequest === readSequence.current) setError(e instanceof Error ? e.message : "Não foi possível carregar as avaliações.");
      }
    }
    const onFocus = () => { void refresh(); };
    void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    return () => { active = false; window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [roundId, roundStatus, organizer]);

  const open = organizer ? progress?.abertas : personal?.open;
  const completed = personal?.players.filter(player => player.avaliado).length ?? 0;

  async function toggle(open: boolean) {
    if (!organizer || busy || (open && roundStatus !== "finalizado")) return;
    if (!open && !window.confirm("Fechar avaliacoes? Jogadores nao poderao editar as notas depois disso.")) return;
    if (open && !window.confirm("Abrir avaliacoes para jogadores que participaram das partidas finalizadas?")) return;
    ++readSequence.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await setRoundEvaluationsOpen(roundId, open);
      setProgress(data);
      setMessage(open ? "Avaliacoes abertas." : "Avaliacoes fechadas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel alterar avaliacoes.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-black">Avaliações</h3>
        <p className="mt-1 text-xs text-zinc-600">Notas pos-jogo dos companheiros de time</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${open ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{open === undefined ? "Carregando" : open ? "ABERTA" : "FECHADA"}</span>
    </div>
    {organizer && progress ? <p className="rounded-xl bg-zinc-50 p-3 text-sm font-bold text-zinc-800">{progress.respondentes} de {progress.total} jogadores responderam</p> : !organizer && personal ? <p className="rounded-xl bg-zinc-50 p-3 text-sm font-bold text-zinc-800">{completed} de {personal.players.length} companheiros avaliados</p> : <p className="text-sm text-zinc-600">Carregando progresso...</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {organizer && roundStatus !== "finalizado" && <p className="text-sm text-zinc-600">Finalize pelo menos uma partida e encerre a rodada antes de abrir avaliações.</p>}
    {!organizer && open === false && <p className="text-sm font-bold text-zinc-600">Avaliações fechadas</p>}
    {!organizer && open && <button onClick={() => onOpenEvaluate(roundId)} disabled={Boolean(error)} className="min-h-12 w-full rounded-[16px] bg-red-600 px-3 text-sm font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50">AVALIAR MEU TIME</button>}
    {organizer && <div className="grid grid-cols-2 gap-2">
      <button disabled={busy || !progress || progress.abertas || roundStatus !== "finalizado"} onClick={() => toggle(true)} className="min-h-11 rounded-xl bg-red-600 px-3 text-xs font-black uppercase text-white disabled:opacity-50">ABRIR AVALIAÇÕES</button>
      <button disabled={busy || !progress?.abertas} onClick={() => toggle(false)} className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-black uppercase disabled:opacity-50">Fechar</button>
    </div>}
  </section>;
}
