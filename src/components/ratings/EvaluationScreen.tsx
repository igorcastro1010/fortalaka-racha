"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { attributes } from "@/lib/ratings/summary";
import { getEvaluationState, saveEvaluation, type EvaluationPlayer, type EvaluationScores, type EvaluationState } from "@/lib/ratings/repository";

const emptyScores: EvaluationScores = { passe: 3, chute: 3, velocidade: 3, defesa: 3, fisico: 3 };

export function EvaluationScreen({ roundId, onStateChange, onReadStatusChange, refreshToken = 0 }: { roundId?: string; onStateChange?: (state: EvaluationState | null) => void; onReadStatusChange?: (status: { loading: boolean; error: string }) => void; refreshToken?: number }) {
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
    onReadStatusChange?.({ loading: true, error: "" });
    try {
      const data = await getEvaluationState(roundId);
      if (request === readSequence.current) { setState(data); onStateChange?.(data); onReadStatusChange?.({ loading: false, error: "" }); }
    } catch (e) {
      console.error("Carregar avaliações", e);
      setError("Não foi possível carregar as avaliações. Tente novamente.");
      onReadStatusChange?.({ loading: false, error: "Não foi possível carregar as avaliações. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }, [roundId, onStateChange, onReadStatusChange]);

  useEffect(() => {
    let active = true;
    async function read() {
      if (savingRef.current) return;
      const currentRequest = ++readSequence.current;
      try {
        const data = await getEvaluationState(roundId);
        if (active && currentRequest === readSequence.current && !savingRef.current) { setState(data); onStateChange?.(data); onReadStatusChange?.({ loading: false, error: "" }); setError(""); }
      } catch (e) {
        console.error("Atualizar avaliações", e);
        if (active && currentRequest === readSequence.current && !savingRef.current) { setError("Não foi possível carregar as avaliações. Tente novamente."); onReadStatusChange?.({ loading: false, error: "Não foi possível carregar as avaliações. Tente novamente." }); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void read();
    const onFocus = () => { void read(); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 15000);
    return () => { active = false; window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [roundId, onStateChange, onReadStatusChange, refreshToken]);

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
      onStateChange?.(next);
      setSelected(null);
      setMessage("Avaliação enviada ✓");
    } catch (e) {
      console.error("Enviar avaliação", e);
      setError("Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <section className="min-w-0 space-y-5">
    <div>
      <h3 className="text-xl font-black leading-tight">AVALIE SEU TIME</h3>
      <p className="mt-0.5 text-sm font-bold text-zinc-600">Notas de 1 a 5 para seus companheiros</p>
    </div>

    {loading && <LoadingCards label="Carregando avaliacoes..." />}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-100"><p>{error}</p><button onClick={reload} className="mt-2 min-h-11 underline">Tentar novamente</button></div>}
    {message && <Status tone="success" text={message} />}

    {!loading && !error && !state && <Card><p className="text-sm font-bold text-zinc-600">Nenhuma rodada com avaliacoes disponiveis.</p></Card>}
    {state && !state.open && <Status tone="neutral" text="As avaliacoes desta rodada estao fechadas. Voce pode consultar o que ja enviou." />}
    {state && !state.canEvaluate && state.open && <Card><p className="text-sm font-bold text-zinc-600">Voce nao tem companheiros elegiveis para avaliar nesta rodada. Apenas quem participou de partida finalizada pode avaliar.</p></Card>}

    {state && <div hidden={Boolean(selected)}><Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold">{state.roundName}</h3>
        </div>
        <span className={`shrink-0 px-2 py-1 text-xs font-bold uppercase ${state.open ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{state.open ? "Aberta" : "Fechada"}</span>
      </div>
      <p aria-live="polite" className="text-sm font-bold tabular-nums text-zinc-600">{state.players.filter(player => player.avaliado).length} de {state.players.length} companheiros avaliados</p>
      <div className="divide-y divide-zinc-100">
        {state.players.map(player => <div key={player.jogador_id} className="flex min-h-16 items-center gap-3 py-2">
          <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-black">{player.nome}</p>
            <p className={`mt-1 text-xs font-bold ${player.avaliado ? "text-emerald-700" : "text-amber-700"}`}>{player.avaliado ? "Avaliado ✓" : "Pendente"}</p>
          </div>
          {(state.open || player.avaliado) && <button onClick={() => openPlayer(player)} disabled={saving || loading || Boolean(error) || (state.open && !state.canEvaluate)} aria-label={`${state.open ? player.avaliado ? "Editar avaliação de" : "Avaliar" : "Ver avaliação de"} ${player.nome}`} className="fk-secondary min-h-11 shrink-0 rounded-lg border border-zinc-300 px-3 text-xs font-black text-neutral-950 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50">{state.open ? player.avaliado ? "EDITAR" : "AVALIAR" : "VER"}</button>}
        </div>)}
        {!state.players.length && <EmptyState icon={Users} title="Nenhum companheiro elegível" description="Seus companheiros aparecem aqui após participarem de uma partida finalizada no mesmo time." />}
      </div>
    </Card></div>}

    {selected && <div ref={formArea} tabIndex={-1} aria-label={`Avaliação de ${selected.nome}`} className="scroll-mt-4 focus-visible:outline-2 focus-visible:outline-red-600"><Card className="space-y-5 border-t-2 border-red-700 pt-5">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={selected.nome} avatarUrl={selected.avatar_url} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-red-700">{!state?.open ? "Avaliação enviada" : selected.avaliado ? "Editar avaliacao" : "Nova avaliacao"}</p>
          <h3 className="break-words text-xl font-black">{selected.nome}</h3>
        </div>
      </div>
      {attributes.map(({ key, label }) => <div key={key} className="space-y-2">
        <p className="text-sm font-black">{label}</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(value => {
            const active = scores[key] === value;
            return <button aria-label={`${label}: ${value} de 5`} aria-pressed={active} key={value} disabled={saving || !canEdit} onClick={() => setScores(current => ({ ...current, [key]: value }))} className={`h-12 rounded-lg text-base font-black ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60 ${active ? "bg-red-700 text-white ring-red-700" : "bg-white text-zinc-800 ring-zinc-300"}`}>{value}</button>;
          })}
        </div>
      </div>)}
      <button onClick={submit} disabled={saving || !canEdit} className="fk-primary min-h-12 w-full rounded-lg bg-red-700 px-3 text-sm font-black uppercase text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60">{saving ? "Enviando..." : "ENVIAR AVALIAÇÃO"}</button>
      {!state?.open && <p className="text-center text-xs font-bold text-zinc-500">Avaliacoes fechadas para edicao.</p>}
      <button disabled={saving} onClick={() => setSelected(null)} className="fk-secondary min-h-11 w-full rounded-lg border border-zinc-300 text-sm font-bold disabled:opacity-50">Voltar aos companheiros</button>
    </Card></div>}
  </section>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`fk-panel min-w-0 ${className}`}>{children}</div>;
}

function Status({ text, tone }: { text: string; tone: "neutral" | "success" }) {
  const toneClass = tone === "success" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-zinc-50 text-zinc-700 ring-zinc-100";
  return <p role={tone === "success" ? "status" : undefined} className={`rounded-lg p-3 text-sm font-bold ring-1 ${toneClass}`}>{text}</p>;
}
