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
    } catch (e) { console.error("Salvar rodada", e); setError("Não foi possível salvar a rodada. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4 py-4">
    <h3 className="text-lg font-black">{round ? "Editar rodada" : "Criar rodada"}</h3>
    {[{ label: "Data", type: "date", value: date, change: setDate }, { label: "Horário", type: "time", value: time, change: setTime }, { label: "Endereço", type: "text", value: address, change: setAddress }].map(field => <label key={field.label} className="block text-sm font-bold">{field.label}<input required disabled={busy} type={field.type} value={field.value} onChange={event => field.change(event.target.value)} className="fk-field mt-2 min-w-0" /></label>)}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    <button disabled={busy} className="fk-primary w-full">{busy ? "SALVANDO..." : round ? "SALVAR RODADA" : "CRIAR RODADA"}</button>
  </form>;
}
