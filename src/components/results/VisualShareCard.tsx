"use client";

import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import Image from 'next/image';
import type { VisualCard } from '@/lib/results/visual-card';

export function VisualShareCard({ cards }: { cards: { id: string; label: string; data: VisualCard }[] }) {
  const [selected, setSelected] = useState(cards[0]?.id ?? '');
  const [preview, setPreview] = useState<{ blob: Blob; url: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  const card = cards.find(c => c.id === selected) ?? cards[0];
  const cardKey = card ? JSON.stringify(card.data) : '';
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const current = preview?.key === cardKey ? preview : null;
  async function generate() {
    if (!card || busy) return;
    const request = ++sequence.current;
    setBusy(true); setMessage('');
    try {
      const { renderVisualCard } = await import('@/lib/results/render-visual-card');
      const blob = await renderVisualCard(card.data);
      if (sequence.current === request) setPreview({ blob, url: URL.createObjectURL(blob), key: cardKey });
    } catch { if (sequence.current === request) setMessage('Não foi possível gerar a imagem. Tente novamente.'); }
    finally { if (sequence.current === request) setBusy(false); }
  }
  async function share() {
    if (!current) return;
    const file = new File([current.blob], 'fortalaka-story.png', { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) {
      setMessage('Use Salvar imagem para enviar pelo aplicativo de sua preferência.'); return;
    }
    try { await navigator.share({ files: [file], title: 'Racha Fortalaka' }); setMessage('Imagem compartilhada.'); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Não foi possível compartilhar. Use Salvar imagem.'); }
  }
  return <section aria-label="Card visual compartilhável" className="fk-section space-y-3"><h3 className="text-lg font-black">Compartilhar imagem</h3><p className="text-sm text-zinc-600">Story · 1080 × 1920 · confira antes de enviar.</p>
    <label className="block text-sm font-bold">Tipo de card<select value={card?.id ?? ''} onChange={event => setSelected(event.target.value)} className="fk-field mt-2" disabled={busy}>{cards.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <button onClick={generate} disabled={busy} className="fk-secondary w-full">{busy ? 'Gerando imagem...' : 'Gerar preview'}</button>
    {current && <><figure className="mx-auto max-w-[300px] overflow-hidden rounded-lg bg-neutral-950"><Image unoptimized src={current.url} alt={`Preview: ${card.data.title}`} width={1080} height={1920} className="h-auto w-full" /><figcaption className="p-3 text-center text-xs text-white">{card.label} · 1080 × 1920</figcaption></figure><div className="grid grid-cols-2 gap-2"><button onClick={share} className="fk-primary"><Share2 size={18} aria-hidden="true" />Compartilhar</button><a href={current.url} download="fortalaka-story.png" className="fk-secondary"><Download size={18} aria-hidden="true" />Salvar imagem</a></div></>}
    {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
  </section>;
}
