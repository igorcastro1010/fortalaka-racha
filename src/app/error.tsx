"use client";

import Link from 'next/link';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-[640px] space-y-4 p-5">
    <h1 className="text-2xl font-black">Não foi possível carregar agora</h1>
    <p role="alert">O serviço pode estar temporariamente indisponível. Tente novamente sem sair da sua conta.</p>
    <button className="fk-primary" onClick={reset}>Tentar novamente</button>
    <Link href="/login" className="fk-secondary">Voltar ao acesso</Link>
  </main>;
}
