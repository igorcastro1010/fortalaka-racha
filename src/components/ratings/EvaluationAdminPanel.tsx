"use client";

import { useEffect, useState } from "react";
import { getEvaluationProgress, setRoundEvaluationsOpen, type EvaluationProgress } from "@/lib/ratings/repository";

export function EvaluationAdminPanel({ roundId, organizer }: { roundId: string; organizer: boolean }) {
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getEvaluationProgress(roundId).then(data => {
      if (active) { setProgress(data); setError(""); }
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : "Nao foi possivel carregar o progresso das avaliacoes.");
    });
    return () => { active = false; };
  }, [roundId]);

  async function toggle(open: boolean) {
    if (!open && !window.confirm("Fechar avaliacoes? Jogadores nao poderao editar as notas depois disso.")) return;
    if (open && !window.confirm("Abrir avaliacoes para jogadores que participaram das partidas finalizadas?")) return;
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
      setBusy(false);
    }
  }

  return <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-black">Avaliacoes</h3>
        <p className="mt-1 text-xs text-zinc-600">Notas pos-jogo dos companheiros de time</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${progress?.abertas ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{progress?.abertas ? "Aberta" : "Fechada"}</span>
    </div>
    {progress ? <p className="rounded-xl bg-zinc-50 p-3 text-sm font-bold text-zinc-800">{progress.respondentes} de {progress.total} jogadores responderam</p> : <p className="text-sm text-zinc-600">Carregando progresso...</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {organizer && <div className="grid grid-cols-2 gap-2">
      <button disabled={busy || progress?.abertas} onClick={() => toggle(true)} className="min-h-11 rounded-xl bg-red-600 px-3 text-xs font-black uppercase text-white disabled:opacity-50">Abrir</button>
      <button disabled={busy || !progress?.abertas} onClick={() => toggle(false)} className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-black uppercase disabled:opacity-50">Fechar</button>
    </div>}
  </section>;
}
