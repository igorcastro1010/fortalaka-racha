"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { attributes } from "@/lib/ratings/summary";
import { getEvaluationState, saveEvaluation, type EvaluationPlayer, type EvaluationScores, type EvaluationState } from "@/lib/ratings/repository";

const emptyScores: EvaluationScores = { passe: 3, chute: 3, velocidade: 3, defesa: 3, fisico: 3 };

export function EvaluationScreen() {
  const [state, setState] = useState<EvaluationState | null>(null);
  const [selected, setSelected] = useState<EvaluationPlayer | null>(null);
  const [scores, setScores] = useState<EvaluationScores>(emptyScores);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setState(await getEvaluationState());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel carregar as avaliacoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function read() {
      try {
        const data = await getEvaluationState();
        if (active) { setState(data); setError(""); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Nao foi possivel carregar as avaliacoes.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void read();
    return () => { active = false; };
  }, []);

  function openPlayer(player: EvaluationPlayer) {
    setSelected(player);
    setScores({
      passe: player.passe ?? 3,
      chute: player.chute ?? 3,
      velocidade: player.velocidade ?? 3,
      defesa: player.defesa ?? 3,
      fisico: player.fisico ?? 3,
    });
    setMessage("");
    setError("");
  }

  async function submit() {
    if (!state || !selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveEvaluation(state.roundId, selected.jogador_id, scores);
      const next = await getEvaluationState();
      setState(next);
      const updated = next?.players.find(player => player.jogador_id === selected.jogador_id) ?? null;
      setSelected(updated);
      setMessage("Avaliacao enviada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel enviar a avaliacao.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="space-y-3">
    <div>
      <h2 className="text-[29px] font-black leading-tight">Avaliar</h2>
      <p className="mt-0.5 text-sm font-bold text-zinc-600">Notas pos-jogo para seus companheiros</p>
    </div>

    {loading && <Status tone="neutral" text="Carregando avaliacoes..." />}
    {error && <div role="alert" className="rounded-[16px] bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-100"><p>{error}</p><button onClick={reload} className="mt-2 min-h-10 underline">Tentar novamente</button></div>}
    {message && <Status tone="success" text={message} />}

    {!loading && !error && !state && <Card><p className="text-sm font-bold text-zinc-600">Nenhuma rodada com avaliacoes disponiveis.</p></Card>}
    {state && !state.open && <Status tone="neutral" text="As avaliacoes desta rodada estao fechadas. Voce pode consultar o que ja enviou." />}
    {state && !state.canEvaluate && state.open && <Card><p className="text-sm font-bold text-zinc-600">Voce nao tem companheiros elegiveis para avaliar nesta rodada. Apenas quem participou de partida finalizada pode avaliar.</p></Card>}

    {state && <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-red-600">Avalie seu time</p>
          <h3 className="text-lg font-black">{state.roundName}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${state.open ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{state.open ? "Aberta" : "Fechada"}</span>
      </div>
      <div className="divide-y divide-zinc-100">
        {state.players.map(player => <button key={player.jogador_id} onClick={() => openPlayer(player)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left">
          <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} />
          <span className="min-w-0 flex-1 break-words text-sm font-black">{player.nome}</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${player.avaliado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{player.avaliado ? "Avaliado" : "Pendente"}</span>
        </button>)}
        {!state.players.length && <p className="py-3 text-sm font-bold text-zinc-500">Nenhum companheiro elegivel.</p>}
      </div>
    </Card>}

    {selected && <Card className="space-y-4 border-t-[3px] border-red-600">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={selected.nome} avatarUrl={selected.avatar_url} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-red-600">{selected.avaliado ? "Editar avaliacao" : "Nova avaliacao"}</p>
          <h3 className="break-words text-xl font-black">{selected.nome}</h3>
        </div>
      </div>
      {attributes.map(({ key, label }) => <div key={key} className="space-y-2">
        <p className="text-sm font-black">{label}</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(value => {
            const active = scores[key] === value;
            return <button key={value} disabled={saving || !state?.open} onClick={() => setScores(current => ({ ...current, [key]: value }))} className={`h-12 rounded-xl text-base font-black ring-1 transition active:scale-95 disabled:opacity-60 ${active ? "bg-red-600 text-white ring-red-600" : "bg-white text-zinc-800 ring-zinc-200"}`}>{value}</button>;
          })}
        </div>
      </div>)}
      <button onClick={submit} disabled={saving || !state?.open} className="h-12 w-full rounded-[16px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 disabled:opacity-60">{saving ? "Enviando..." : "Enviar avaliacao"}</button>
      {!state?.open && <p className="text-center text-xs font-bold text-zinc-500">Avaliacoes fechadas para edicao.</p>}
    </Card>}
  </section>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(0,0,0,0.035)] ring-1 ring-black/5 ${className}`}>{children}</div>;
}

function Status({ text, tone }: { text: string; tone: "neutral" | "success" }) {
  const toneClass = tone === "success" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-zinc-50 text-zinc-700 ring-zinc-100";
  return <p className={`rounded-[16px] p-3 text-sm font-bold ring-1 ${toneClass}`}>{text}</p>;
}
