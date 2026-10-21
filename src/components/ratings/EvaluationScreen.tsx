"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { attributes } from "@/lib/ratings/summary";
import { getEvaluationState, saveEvaluation, type EvaluationPlayer, type EvaluationScores, type EvaluationState } from "@/lib/ratings/repository";

const emptyScores: EvaluationScores = { passe: 3, chute: 3, velocidade: 3, defesa: 3, fisico: 3 };

export function EvaluationScreen({ roundId }: { roundId?: string }) {
  const [state, setState] = useState<EvaluationState | null>(null);
  const [selected, setSelected] = useState<EvaluationPlayer | null>(null);
  const [scores, setScores] = useState<EvaluationScores>(emptyScores);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const savingRef = useRef(false);
  const readSequence = useRef(0);

  const reload = useCallback(async () => {
    if (savingRef.current) return;
    const request = ++readSequence.current;
    setLoading(true);
    setError("");
    try {
      const data = await getEvaluationState(roundId);
      if (request === readSequence.current) setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel carregar as avaliacoes.");
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => {
    let active = true;
    async function read() {
      if (savingRef.current) return;
      const currentRequest = ++readSequence.current;
      try {
        const data = await getEvaluationState(roundId);
        if (active && currentRequest === readSequence.current && !savingRef.current) { setState(data); setError(""); }
      } catch (e) {
        if (active && currentRequest === readSequence.current && !savingRef.current) setError(e instanceof Error ? e.message : "Nao foi possivel carregar as avaliacoes.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void read();
    const onFocus = () => { void read(); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 15000);
    return () => { active = false; window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [roundId]);

  const formArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) {
      formArea.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      formArea.current?.focus({ preventScroll: true });
    }
  }, [selected]);
  const canEdit = !loading && !error && Boolean(state?.open && state.canEvaluate);

  function openPlayer(player: EvaluationPlayer) {
    if (saving) return;
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
    if (!state || !selected || !canEdit || saving) return;
    if (!Object.values(scores).every(value => Number.isInteger(value) && value >= 1 && value <= 5)) {
      setError("Escolha notas inteiras de 1 a 5.");
      return;
    }
    ++readSequence.current;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveEvaluation(state.roundId, selected.jogador_id, scores);
      const next = await getEvaluationState(roundId);
      setState(next);
      setSelected(null);
      setMessage("Avaliação enviada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel enviar a avaliacao.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <section className="space-y-3">
    <div>
      <h2 className="text-[29px] font-black leading-tight">AVALIE SEU TIME</h2>
      <p className="mt-0.5 text-sm font-bold text-zinc-600">Notas de 1 a 5 para seus companheiros</p>
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
      <p aria-live="polite" className="text-sm font-bold text-zinc-600">{state.players.filter(player => player.avaliado).length} de {state.players.length} companheiros avaliados</p>
      <div className="divide-y divide-zinc-100">
        {state.players.map(player => <div key={player.jogador_id} className="flex min-h-20 items-center gap-3 py-3">
          <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-black">{player.nome}</p>
            <p className={`mt-1 text-xs font-bold ${player.avaliado ? "text-emerald-700" : "text-amber-700"}`}>Status: {player.avaliado ? "Avaliado ✓" : "Pendente"}</p>
          </div>
          {(state.open || player.avaliado) && <button onClick={() => openPlayer(player)} disabled={saving || loading || Boolean(error) || (state.open && !state.canEvaluate)} aria-label={`${state.open ? player.avaliado ? "Editar avaliação de" : "Avaliar" : "Ver avaliação de"} ${player.nome}`} className="min-h-11 shrink-0 rounded-xl bg-neutral-950 px-3 text-xs font-black text-white disabled:opacity-50">{state.open ? player.avaliado ? "EDITAR" : "AVALIAR" : "VER"}</button>}
        </div>)}
        {!state.players.length && <p className="py-3 text-sm font-bold text-zinc-500">Nenhum companheiro elegivel.</p>}
      </div>
    </Card>}

    {selected && <div ref={formArea} tabIndex={-1} aria-label={`Avaliação de ${selected.nome}`} className="scroll-mt-4 rounded-[22px] focus-visible:outline-2 focus-visible:outline-red-600"><Card className="space-y-4 border-t-[3px] border-red-600">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={selected.nome} avatarUrl={selected.avatar_url} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-red-600">{!state?.open ? "Avaliação enviada" : selected.avaliado ? "Editar avaliacao" : "Nova avaliacao"}</p>
          <h3 className="break-words text-xl font-black">{selected.nome}</h3>
        </div>
      </div>
      {attributes.map(({ key, label }) => <div key={key} className="space-y-2">
        <p className="text-sm font-black">{label}</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(value => {
            const active = scores[key] === value;
            return <button aria-label={`${label}: ${value} de 5`} aria-pressed={active} key={value} disabled={saving || !canEdit} onClick={() => setScores(current => ({ ...current, [key]: value }))} className={`h-12 rounded-xl text-base font-black ring-1 transition active:scale-95 disabled:opacity-60 ${active ? "bg-red-600 text-white ring-red-600" : "bg-white text-zinc-800 ring-zinc-200"}`}>{value}</button>;
          })}
        </div>
      </div>)}
      <button onClick={submit} disabled={saving || !canEdit} className="h-12 w-full rounded-[16px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 disabled:opacity-60">{saving ? "Enviando..." : "ENVIAR AVALIAÇÃO"}</button>
      {!state?.open && <p className="text-center text-xs font-bold text-zinc-500">Avaliacoes fechadas para edicao.</p>}
      <button disabled={saving} onClick={() => setSelected(null)} className="min-h-11 w-full rounded-xl border border-zinc-200 text-xs font-bold disabled:opacity-50">Voltar aos companheiros</button>
    </Card></div>}
  </section>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(0,0,0,0.035)] ring-1 ring-black/5 ${className}`}>{children}</div>;
}

function Status({ text, tone }: { text: string; tone: "neutral" | "success" }) {
  const toneClass = tone === "success" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-zinc-50 text-zinc-700 ring-zinc-100";
  return <p className={`rounded-[16px] p-3 text-sm font-bold ring-1 ${toneClass}`}>{text}</p>;
}
