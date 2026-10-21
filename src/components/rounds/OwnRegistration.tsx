"use client";

import { useState } from "react";
import type { Profile } from "@/lib/auth/roles";
import { setOwnRegistration, type RoundDetails } from "@/lib/rounds/repository";

export function OwnRegistration({ round, profile, onUpdated }: { round: RoundDetails; profile: Profile; onUpdated: () => void | Promise<void> }) {
  const registration = round.participants.find(player => player.jogadorId === profile.id && player.status === "confirmado");
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canChange = round.status === "aberto" && profile.active;

  async function submit(type: "linha" | "goleiro" | null, join: boolean) {
    if (!canChange || busy) return;
    if (!join && !window.confirm("Sair da lista desta rodada?")) return;
    setBusy(true); setError("");
    try {
      await setOwnRegistration(round.roundId, type, join);
      await onUpdated();
      setChoosing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a inscrição."); }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5">
    <h3 className="text-sm font-black">Sua inscrição</h3>
    <p className="text-sm font-bold text-zinc-700">{registration ? "Você está confirmado para quinta." : "Você ainda não está na lista."}</p>
    {registration && <p className="text-xs font-bold text-red-700">{registration.type === "goleiro" ? "Goleiro" : registration.type === "suplente" ? "Suplente" : "Linha"}</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {canChange ? registration ? <button disabled={busy} onClick={() => submit(null, false)} className="min-h-12 w-full rounded-xl border border-zinc-200 text-xs font-black disabled:opacity-50">{busy ? "SALVANDO..." : "SAIR DA LISTA"}</button> : choosing ? <div>
      <p className="mb-3 text-sm font-black">Como você vai jogar?</p>
      <div className="grid grid-cols-2 gap-2">{(["linha", "goleiro"] as const).map(type => <button key={type} disabled={busy} onClick={() => submit(type, true)} className="min-h-12 rounded-xl bg-neutral-950 text-xs font-black uppercase text-white disabled:opacity-50">{type}</button>)}</div>
      <button disabled={busy} onClick={() => setChoosing(false)} className="mt-2 min-h-11 w-full text-xs font-bold text-zinc-600">CANCELAR</button>
    </div> : <button onClick={() => setChoosing(true)} className="min-h-12 w-full rounded-xl bg-red-600 text-xs font-black text-white">ENTRAR NA LISTA</button> : <p className="text-xs text-zinc-500">{round.status === "finalizado" ? "Racha finalizado. Inscrições preservadas." : "Lista fechada para inscrições e saídas."}</p>}
  </section>;
}
