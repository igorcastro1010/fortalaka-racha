"use client";

import { usePwaRegistration } from './usePwaRegistration';
import { ConnectivityStatus } from './ConnectivityStatus';

export function PwaExperience() {
  const { waiting, updating, error, update } = usePwaRegistration();
  return <>
    <ConnectivityStatus />
    {(waiting || error) && <aside aria-label="Atualização do aplicativo" className="mx-auto max-w-[640px] border-b border-zinc-200 bg-white px-5 py-3 text-neutral-950" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
      {waiting && <><p className="text-sm font-bold">Nova versão disponível.</p><p className="mt-1 text-sm text-zinc-600">Salve suas alterações antes de atualizar.</p><button onClick={update} disabled={updating} className="fk-secondary mt-2">{updating ? 'Atualizando...' : 'Atualizar e recarregar'}</button></>}
      {error && <p role="status" className="mt-1 text-sm text-zinc-600">{error}</p>}
    </aside>}
  </>;
}
