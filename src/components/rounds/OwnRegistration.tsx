"use client";

import { useState } from "react";
import type { Profile } from "@/lib/auth/roles";
import { setOwnRegistration, type RoundDetails } from "@/lib/rounds/repository";

export function OwnRegistration({ round, profile, onUpdated }: { round: RoundDetails; profile: Profile; onUpdated: () => void | Promise<void> }) {
  const registration = round.participants.find(player => player.jogadorId === profile.id && player.status === "confirmado");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canChange = round.status === "aberto" && profile.active;

  async function submit(join: boolean) {
    if (!canChange || busy) return;
    if (!join && !window.confirm("Sair da lista desta rodada?")) return;
    setBusy(true); setError("");
    try {
      await setOwnRegistration(round.roundId, join);
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a inscrição."); }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5">
    <h3 className="text-sm font-black">Sua inscrição</h3>
    <p className="text-sm font-bold text-zinc-700">{registration ? "VOCÊ ESTÁ NA LISTA" : "Você ainda não está na lista."}</p>
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {canChange ? registration ? <button disabled={busy} onClick={() => submit(false)} className="min-h-12 w-full rounded-xl border border-zinc-200 text-xs font-black disabled:opacity-50">{busy ? "SALVANDO..." : "SAIR DA LISTA"}</button> : <button disabled={busy} onClick={() => submit(true)} className="min-h-12 w-full rounded-xl bg-red-600 text-xs font-black text-white disabled:opacity-50">{busy ? "SALVANDO..." : "ENTRAR NA LISTA"}</button> : <p className="text-xs text-zinc-500">{round.status === "finalizado" ? "Racha finalizado. Inscrições preservadas." : "Lista fechada para inscrições e saídas."}</p>}
  </section>;
}
