"use client";

import { Copy, Eye, Share2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { buildRoundShareTextFromSummary, getRoundShareSummary, getWhatsAppShareUrl, type RoundLeader, type RoundShareSource, type RoundShareSummary } from "@/lib/results/round-share";
import { copyRoundShareText, shareRoundText } from "@/lib/results/share-actions";

function leaderLabel(players: RoundLeader[], empty: string) {
  if (!players.length) return empty;
  const tied = players.filter(player => player.value === players[0].value).length;
  return `${players[0].name} · ${players[0].value}${tied > 1 ? ` (+${tied - 1} empatado${tied > 2 ? "s" : ""})` : ""}`;
}

export function RoundShareCard({ roundId, source, summary: providedSummary, compact = false }: { roundId: string; source: RoundShareSource; summary?: RoundShareSummary; compact?: boolean }) {
  const summary = providedSummary ?? getRoundShareSummary(roundId, source);
  const text = buildRoundShareTextFromSummary(summary);
  const url = getWhatsAppShareUrl(text);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hasMatches = summary.matches.length > 0;
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);

  async function share(event: MouseEvent<HTMLAnchorElement>) {
    if (busy) { event.preventDefault(); return; }
    setMessage(""); setError(""); setFallback(false);
    // Sem Web Share, o link funciona como navegação normal do navegador, sem popup via JS.
    if (typeof navigator.share !== "function") return;
    event.preventDefault();
    setBusy(true);
    try {
      if (await shareRoundText(text) === "fallback") {
        setFallback(true);
        setMessage("O compartilhamento do sistema não abriu. Use o link do WhatsApp ou copie o resultado.");
      }
    } finally { setBusy(false); }
  }
  async function copy() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await copyRoundShareText(text); setMessage("Resultado copiado ✓"); }
    catch (e) { console.error("Falha ao copiar resultado", e); setError("Não foi possível copiar o resultado. Abra o resumo e tente novamente."); }
    finally { setBusy(false); }
  }

  return <section aria-label="Resumo para compartilhar" className="fk-section space-y-3 py-5">
    <div className="flex items-center gap-2"><Share2 size={18} aria-hidden="true" /><h3 className="text-sm font-black uppercase">Resumo para compartilhar</h3></div>
    {!compact && <dl className="grid grid-cols-2 gap-2">{[
      ["Partidas finalizadas", String(summary.matches.length)], ["Participantes em campo", String(summary.participantCount)],
      ["Artilharia", leaderLabel(summary.topScorers, "Sem gols registrados")], ["Assistências", leaderLabel(summary.assists, "Sem assistências registradas")],
    ].map(([label, value]) => <div key={label} className="min-w-0 border-l-2 border-zinc-200 py-2 pl-3"><dt className="text-xs font-semibold text-zinc-600">{label}</dt><dd className="mt-1 break-words text-sm font-black">{value}</dd></div>)}</dl>}
    <p className="text-xs leading-relaxed text-zinc-600">Somente partidas finalizadas e eventos registrados nesta rodada.</p>
    {!hasMatches && <p className="text-sm text-zinc-600">Nenhuma partida finalizada para compartilhar.</p>}
    <button onClick={() => setPreview(true)} className="fk-secondary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-black"><Eye size={16} aria-hidden="true" />VER RESUMO</button>
    {hasMatches ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={share} aria-disabled={busy} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-center text-xs font-black text-white transition hover:bg-red-700 ${busy ? "opacity-60" : ""}`}><Share2 size={17} aria-hidden="true" />COMPARTILHAR NO WHATSAPP</a> : <button disabled className="min-h-12 w-full rounded-lg bg-zinc-200 px-3 text-xs font-black text-zinc-500">COMPARTILHAR NO WHATSAPP</button>}
    <button onClick={copy} disabled={busy || !hasMatches} className="fk-secondary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-black disabled:opacity-50"><Copy size={16} aria-hidden="true" />COPIAR RESULTADO</button>
    {message && <p role="status" className="border-l-2 border-red-600 py-2 pl-3 text-sm text-zinc-700">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {fallback && <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 text-xs font-black underline">ABRIR WHATSAPP</a>}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={() => setPreview(false)} onClose={() => setPreview(false)} className="fk-sheet fixed inset-x-0 bottom-0 top-auto m-auto w-full max-w-[430px] rounded-t-lg bg-white p-5 shadow-2xl backdrop:bg-black/50 sm:inset-0 sm:w-[calc(100%-32px)] sm:max-w-sm sm:rounded-lg">
      <div className="flex items-center justify-between gap-2"><h3 id={titleId} className="text-sm font-black uppercase">Resumo do racha</h3><button autoFocus onClick={() => setPreview(false)} aria-label="Fechar resumo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200"><X size={18} /></button></div>
      <pre tabIndex={0} className="mt-3 max-h-[60dvh] overflow-y-auto whitespace-pre-wrap break-words border-t border-zinc-200 py-4 font-sans text-sm leading-relaxed text-zinc-800">{text}</pre>
    </dialog>
  </section>;
}
