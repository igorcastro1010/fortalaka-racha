"use client";

import { useState } from "react";
import type { Participant } from "@/lib/teams/draw";

export function ParticipantEditor({ initial, busy, onSave, onCancel }: {
  initial: Participant[]; busy: boolean; onSave: (participants: Participant[]) => void; onCancel: () => void;
}) {
  const [participants, setParticipants] = useState(initial);
  const [names, setNames] = useState("");
  const [type, setType] = useState<Participant["tipo"]>("linha");
  const [error, setError] = useState("");

  function addNames() {
    const entries = names.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!entries.length) return;
    if (participants.length + entries.length > 100) { setError("Limite de 100 participantes."); return; }
    setParticipants((current) => [...current, ...entries.map((name) => ({
      id: crypto.randomUUID(), name, tipo: type, status: "presente" as const,
    }))]);
    setNames(""); setError("");
  }

  function save() {
    if (names.trim()) { setError("Adicione os nomes digitados à lista antes de salvar."); return; }
    if (participants.some((p) => !p.name.trim() || p.name.trim().length > 100)) {
      setError("Cada participante precisa de um nome entre 1 e 100 caracteres."); return;
    }
    if (participants.filter((p) => p.tipo === "goleiro_fixo" && p.status !== "removido").length !== 2) {
      setError("A rodada deve ter exatamente 2 goleiros fixos."); return;
    }
    setError(""); onSave(participants.map((p) => ({ ...p, name: p.name.trim() })));
  }

  return (
    <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5" aria-label="Participantes da rodada">
      <h3 className="text-lg font-black">Participantes da rodada</h3>
      <p className="text-xs font-semibold text-zinc-600">Cadastre os dois goleiros fixos e os jogadores de linha. Salvar alterações na lista cancela os times confirmados desta rodada.</p>
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
        <label className="block text-sm font-bold">Nomes, um por linha
          <textarea value={names} onChange={(e) => setNames(e.target.value)} rows={4} maxLength={10000}
            className="mt-1 w-full rounded-xl border border-zinc-300 p-3 font-normal" placeholder="Cole ou digite os nomes" />
        </label>
        <label className="block text-sm font-bold">Adicionar como
          <select value={type} onChange={(e) => setType(e.target.value as Participant["tipo"])} className="mt-1 w-full rounded-xl border border-zinc-300 p-3">
            <option value="linha">Jogador de linha</option><option value="goleiro_fixo">Goleiro fixo</option><option value="suplente">Suplente</option>
          </select>
        </label>
        <button type="button" onClick={addNames} className="w-full rounded-xl bg-neutral-950 p-3 text-sm font-black text-white">ADICIONAR À LISTA</button>
        <ul className="space-y-3">
          {participants.map((p, index) => (
            <li key={p.id} className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <label className="block text-xs font-bold">Nome do participante {index + 1}
                <input value={p.name} maxLength={100} onChange={(e) => setParticipants((current) => current.map((item) => item.id === p.id ? { ...item, name: e.target.value } : item))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold">Tipo
                  <select aria-label={`Tipo de ${p.name || index + 1}`} value={p.tipo}
                    onChange={(e) => setParticipants((current) => current.map((item) => item.id === p.id ? { ...item, tipo: e.target.value as Participant["tipo"] } : item))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs">
                    <option value="linha">Linha</option><option value="goleiro_fixo">Goleiro fixo</option><option value="suplente">Suplente</option>
                  </select>
                </label>
                <label className="text-xs font-bold">Presença
                  <select aria-label={`Presença de ${p.name || index + 1}`} value={p.status}
                    onChange={(e) => setParticipants((current) => current.map((item) => item.id === p.id ? { ...item, status: e.target.value as Participant["status"] } : item))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs">
                    <option value="presente">Presente</option><option value="ausente">Ausente</option><option value="removido">Removido</option>
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <button type="button" onClick={save} className="w-full rounded-xl bg-red-600 p-3 font-black text-white">{busy ? "SALVANDO..." : "SALVAR PARTICIPANTES"}</button>
        <button type="button" onClick={onCancel} className="w-full rounded-xl border border-zinc-300 p-3 font-bold">CANCELAR</button>
      </fieldset>
    </section>
  );
}
