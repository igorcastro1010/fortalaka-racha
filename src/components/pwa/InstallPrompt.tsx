"use client";

import { useEffect, useRef, useState } from 'react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const DISMISSED = 'fortalaka:pwa:install-dismissed:v1';

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const refused = useRef(false);
  useEffect(() => {
    let active = true;
    const standalone = window.matchMedia('(display-mode: standalone)');
    const installed = () => standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISSED) === '1'; } catch { /* Armazenamento pode estar bloqueado. */ }
    const available = (event: Event) => {
      event.preventDefault();
      if (!dismissed && !refused.current && !installed()) { setPrompt(event as InstallEvent); setHidden(false); }
    };
    const hide = () => { if (installed()) { setHidden(true); setPrompt(null); } };
    const complete = () => { setHidden(true); setPrompt(null); };
    void Promise.resolve().then(() => {
      if (!active || installed() || dismissed) return;
      const ua = navigator.userAgent;
      const apple = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (apple && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) { setIos(true); setHidden(false); }
    });
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', complete);
    standalone.addEventListener('change', hide);
    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', complete);
      standalone.removeEventListener('change', hide);
    };
  }, []);
  function dismiss() {
    refused.current = true;
    try { localStorage.setItem(DISMISSED, '1'); } catch { /* A recusa permanece válida nesta visita. */ }
    setHidden(true); setPrompt(null); setIos(false);
  }
  async function install() {
    if (pending.current) return;
    if (ios && !prompt) { setInstructions(true); return; }
    if (!prompt) return;
    pending.current = true; setBusy(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'dismissed') dismiss();
      else { setHidden(true); setPrompt(null); }
    } catch {
      setPrompt(null); setHidden(true);
    } finally { pending.current = false; setBusy(false); }
  }
  if (hidden || (!prompt && !ios)) return null;
  return <aside aria-label="Instalação do Fortalaka" className="mx-auto max-w-[640px] border-b border-zinc-200 bg-white px-5 py-3 text-neutral-950" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
    <p className="text-sm font-bold">Fortalaka na tela de início</p>
    <p className="mt-1 text-sm text-zinc-600">Abra o racha direto pelo ícone do aplicativo.</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className="fk-secondary" onClick={install} disabled={busy}>{busy ? 'Abrindo instalação...' : 'Instalar Fortalaka'}</button>
      <button type="button" className="fk-ghost min-h-12 px-3 text-sm" onClick={dismiss}>Agora não</button>
    </div>
    {instructions && <p role="status" className="mt-2 text-sm text-zinc-600">No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.</p>}
  </aside>;
}
