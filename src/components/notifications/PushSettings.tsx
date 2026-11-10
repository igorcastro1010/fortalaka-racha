"use client";

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, RefreshCw } from 'lucide-react';
import { disablePush, enablePush, getPushStatus, pushAvailability, pushErrorMessage, type PushStatus } from '@/lib/notifications/push';

export function PushSettings() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    getPushStatus().then(value => { if (active) setStatus(value); })
      .catch(() => { if (active) setError('Não foi possível consultar este dispositivo.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function change(action: 'enable' | 'disable' | 'refresh') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (action === 'enable') await enablePush();
      if (action === 'disable') await disablePush();
      const next = await getPushStatus();
      setStatus(next);
    } catch (cause) {
      setError(pushErrorMessage(cause));
      const unavailable = pushAvailability();
      if (unavailable) setStatus(unavailable);
      else {
        try { setStatus(await getPushStatus()); }
        catch { setStatus(null); }
      }
    } finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Notificações neste dispositivo" className="min-w-0 space-y-3 border-y border-zinc-200 py-4">
    <h2 className="flex items-center gap-2 text-base font-black"><Bell size={20} aria-hidden="true" />Neste dispositivo</h2>
    <p role="status" className="break-words text-sm text-zinc-600">{busy ? 'Consultando dispositivo...' : status === null ? 'Não foi possível verificar a ativação deste dispositivo.' : ({ enabled: 'Notificações ativadas.', disabled: 'Notificações desativadas.', denied: 'Permissão bloqueada. Libere as notificações nos ajustes do navegador e tente novamente.', unsupported: 'Este navegador não oferece notificações push. Seus avisos continuam disponíveis no app.', homescreen: 'No iPhone ou iPad, adicione o app à Tela de Início pelo menu Compartilhar e abra pelo ícone para ativar as notificações.', unconfigured: 'Notificações push ainda não estão disponíveis.' }[status])}</p>
    {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {status === 'disabled' && <button disabled={busy} onClick={() => change('enable')} className="fk-primary min-h-11 max-w-full whitespace-normal"><Bell size={18} aria-hidden="true" />Ativar neste dispositivo</button>}
      {(status === 'enabled' || status === 'denied' || status === 'unconfigured' || Boolean(error)) && <button disabled={busy} onClick={() => change('disable')} className="fk-secondary min-h-11 max-w-full whitespace-normal"><BellOff size={18} aria-hidden="true" />Desativar neste dispositivo</button>}
      <button aria-label="Consultar notificações do dispositivo" title="Consultar dispositivo" disabled={busy} onClick={() => change('refresh')} className="fk-secondary min-h-11 min-w-11"><RefreshCw size={18} aria-hidden="true" /></button>
    </div>
  </section>;
}
