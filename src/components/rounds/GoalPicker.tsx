"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { PlayerAvatar } from '@/components/players/PlayerAvatar';
import type { MatchPlayer } from '@/lib/matches/repository';

export function GoalPicker({ teamName, players, correctingPlayer, onSelect, onClose }: {
  teamName: string; players: MatchPlayer[]; correctingPlayer?: MatchPlayer;
  onSelect: (scorerId: string | null, assistantId: string | null) => void;
  onClose: () => void;
}) {
  const [scorer, setScorer] = useState<MatchPlayer | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [scorer]);
  const eligible = players.filter(p => p.participou && p.jogador_id !== (scorer?.jogador_id ?? correctingPlayer?.jogador_id));
  const title = correctingPlayer ? 'Quem marcou no lugar?' : scorer ? 'Quem deu a assistência?' : 'Quem marcou?';
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className="fk-sheet fixed inset-x-0 bottom-0 top-auto m-auto max-h-[85dvh] w-full max-w-[430px] overflow-y-auto rounded-t-lg bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-950 backdrop:bg-black/50 sm:inset-0 sm:w-[calc(100%-32px)] sm:rounded-lg">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><p className="break-words text-xs font-bold text-red-700">{teamName}</p><h3 ref={heading} tabIndex={-1} id={titleId} className="mt-1 text-lg font-black outline-none">{title}</h3></div>
      <button type="button" onClick={onClose} aria-label="Cancelar lançamento" title="Cancelar lançamento" className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-zinc-200"><X size={20} /></button>
    </div>
    {scorer && <p className="mt-3 break-words text-sm text-zinc-600">Gol de <strong>{scorer.nome}</strong></p>}
    {correctingPlayer && <p className="mt-3 break-words text-sm text-zinc-600">Substituir um gol de {correctingPlayer.nome}. Placar e assistências mantidos.</p>}
    <div className="my-4 grid grid-cols-2 gap-2">
      {eligible.map(player => <button key={player.jogador_id} type="button" aria-label={player.nome} onClick={() => {
        if (correctingPlayer) onSelect(player.jogador_id, null);
        else if (scorer) onSelect(scorer.jogador_id, player.jogador_id);
        else setScorer(player);
      }} className="flex min-h-16 min-w-0 items-center gap-2 rounded border border-zinc-200 p-2 text-left hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 active:bg-red-100">
        <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" /><span className="min-w-0 break-words text-sm font-bold">{player.nome}</span>
      </button>)}
    </div>
    {!eligible.length && <p className="my-3 text-sm text-zinc-600">Nenhum outro participante neste time.</p>}
    {!correctingPlayer && <button type="button" onClick={() => onSelect(scorer?.jogador_id ?? null, null)} className="fk-secondary min-h-12 w-full text-sm font-bold">{scorer ? 'Sem assistência' : 'Só ajustar placar'}</button>}
    {scorer && <button type="button" onClick={() => setScorer(null)} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={18} />Trocar autor</button>}
  </dialog>;
}
