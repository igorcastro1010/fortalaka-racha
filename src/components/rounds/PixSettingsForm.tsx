"use client";

import { Save, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPixSettings, savePixSettings, type PixSettings } from "@/lib/payments/repository";

export function PixSettingsForm() {
  const [open, setOpen] = useState(false);
  return <details className="fk-section" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold"><Settings2 size={18} aria-hidden="true" />Configurações de pagamento</summary>
    {open && <SettingsFields />}
  </details>;
}

function SettingsFields() {
  const [settings, setSettings] = useState<PixSettings | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getPixSettings().then(data => { if (active) { setSettings(data); setError(""); } }).catch(() => { if (active) setError("Não foi possível carregar a configuração PIX."); });
    return () => { active = false; };
  }, [attempt]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || submitting.current) return;
    const input = { chave_pix: settings.chave_pix.replace(/\D/g, ""), titular: settings.titular.trim(), banco: settings.banco.trim() };
    setError(""); setMessage("");
    if (input.chave_pix.length !== 11 || !input.titular || !input.banco) { setError("Informe um CPF com 11 dígitos, titular e banco."); return; }
    submitting.current = true; setBusy(true);
    try { await savePixSettings(input); setSettings(input); setMessage("Dados PIX atualizados."); }
    catch { setError("Não foi possível salvar os dados PIX. Tente novamente."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <form onSubmit={save} aria-label="Configuração PIX" aria-busy={busy} className="mt-3 space-y-3">
    {!settings && !error && <p role="status" className="text-sm text-zinc-600">Carregando configuração...</p>}
    {settings && <>
      <label className="block text-sm font-bold">Chave PIX (CPF)<input className="fk-field mt-1" inputMode="numeric" autoComplete="off" required maxLength={14} disabled={busy} value={settings.chave_pix} onChange={event => setSettings({ ...settings, chave_pix: event.target.value })} /></label>
      <label className="block text-sm font-bold">Titular<input className="fk-field mt-1" required maxLength={100} disabled={busy} value={settings.titular} onChange={event => setSettings({ ...settings, titular: event.target.value })} /></label>
      <label className="block text-sm font-bold">Banco<input className="fk-field mt-1" required maxLength={100} disabled={busy} value={settings.banco} onChange={event => setSettings({ ...settings, banco: event.target.value })} /></label>
      <button className="fk-primary w-full" disabled={busy}><Save size={18} aria-hidden="true" />{busy ? "Salvando..." : "Salvar dados PIX"}</button>
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!settings && error && <button type="button" className="fk-secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}
    {message && <p role="status" className="text-sm font-bold">{message}</p>}
  </form>;
}
