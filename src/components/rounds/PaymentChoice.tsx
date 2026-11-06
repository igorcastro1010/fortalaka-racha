"use client";

import { Banknote, Check, Copy, QrCode } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { getPixSettings, type PixSettings } from "@/lib/payments/repository";
import type { PaymentMethod } from "@/lib/payments/summary";

export function PaymentChoice({ value, onChange, disabled = false }: { value: PaymentMethod | null; onChange: (method: PaymentMethod) => void; disabled?: boolean }) {
  const id = useId();
  return <fieldset disabled={disabled} className="min-w-0 space-y-2">
    <legend className="mb-2 text-sm font-bold">Forma de pagamento</legend>
    <div className="grid grid-cols-2 gap-2">
      {([{ value: "pix", label: "PIX", icon: QrCode }, { value: "dinheiro", label: "Dinheiro", icon: Banknote }] as const).map(option => <label key={option.value} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold ${value === option.value ? "border-red-700 bg-red-50 text-red-800" : "border-zinc-300 bg-white text-zinc-700"} ${disabled ? "opacity-60" : ""}`}>
        <input type="radio" name={`payment-${id}`} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="accent-red-700" />
        <option.icon size={18} aria-hidden="true" />{option.label}
      </label>)}
    </div>
  </fieldset>;
}

export function PixCard() {
  const [settings, setSettings] = useState<PixSettings | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getPixSettings().then(data => { if (active) { setSettings(data); setError(""); } }).catch(() => {
      if (active) setError("Não foi possível carregar os dados PIX.");
    });
    return () => { active = false; };
  }, [attempt]);
  async function copy() {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.chave_pix);
      setCopyStatus("PIX copiado!");
    } catch { setCopyStatus("Não foi possível copiar. Selecione e copie a chave abaixo."); }
  }
  return <aside aria-label="Dados para pagamento PIX" className="min-w-0 rounded-lg border border-zinc-300 bg-white p-4">
    <h4 className="flex items-center gap-2 text-sm font-black"><QrCode size={19} aria-hidden="true" />Pagamento via PIX</h4>
    {!settings && !error && <p role="status" className="mt-3 text-sm text-zinc-600">Carregando dados PIX...</p>}
    {error && <div className="mt-3"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" className="fk-tertiary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
    {settings && <>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="text-zinc-600">Chave PIX (CPF)</dt><dd className="select-all break-all font-mono font-bold">{settings.chave_pix}</dd></div>
        <div><dt className="text-zinc-600">Titular</dt><dd className="break-words font-bold">{settings.titular}</dd></div>
        <div><dt className="text-zinc-600">Banco</dt><dd className="break-words font-bold">{settings.banco}</dd></div>
      </dl>
      <button type="button" onClick={copy} className="fk-secondary mt-3 w-full">{copyStatus === "PIX copiado!" ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}Copiar PIX</button>
      {copyStatus && <p role="status" className="mt-2 text-sm font-bold">{copyStatus}</p>}
      <p className="mt-3 text-xs text-zinc-600">O recebimento será confirmado por um organizador.</p>
    </>}
  </aside>;
}
