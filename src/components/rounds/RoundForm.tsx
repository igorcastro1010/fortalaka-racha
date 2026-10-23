"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createRound, type RoundDetails } from "@/lib/rounds/repository";

export function RoundForm({ round, onSaved }: { round?: RoundDetails; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(round?.date ?? "");
  const [time, setTime] = useState(round?.time?.slice(0, 5) ?? "20:00");
  const [address, setAddress] = useState(round?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const client = createClient();
      if (round) {
        const { error } = await client.from("rachas").update({ data: date, horario: time, endereco: address.trim() }).eq("id", round.roundId);
        if (error) throw error;
      } else await createRound(client, { name: "Racha Fortalaka", date, time, address: address.trim() });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a rodada."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03]">
    <h3 className="text-xl font-black tracking-tight">{round ? "Editar rodada" : "Criar rodada"}</h3>
    {[{ label: "Data", type: "date", value: date, change: setDate }, { label: "Horário", type: "time", value: time, change: setTime }, { label: "Endereço", type: "text", value: address, change: setAddress }].map(field => <label key={field.label} className="block text-xs font-black uppercase tracking-wider text-zinc-500">{field.label}<input required disabled={busy} type={field.type} value={field.value} onChange={event => field.change(event.target.value)} className="mt-1 min-h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none transition focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100/50" /></label>)}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    <button disabled={busy} className="min-h-12 w-full rounded-2xl bg-red-600 text-sm font-black uppercase tracking-wider text-white shadow-md shadow-red-600/20 transition active:scale-95 disabled:opacity-50">{busy ? "SALVANDO..." : round ? "SALVAR RODADA" : "CRIAR RODADA"}</button>
  </form>;
}
