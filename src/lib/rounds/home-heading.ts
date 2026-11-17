export function homeHeading(round: { date: string | null; status: string } | null, now: Date | null, state: 'ready' | 'loading' | 'error' = 'ready'): string {
  if (!round && state === 'loading') return 'Carregando seu racha…';
  if (!round && state === 'error') return 'Não foi possível carregar o racha.';
  if (!round) return 'Seu próximo racha começa aqui.';
  if (round.status === 'finalizado') return 'Confira como foi o racha.';
  if (round.status === 'em_andamento') return 'Bola rolando.';
  if (!round.date || !now) return 'Prepare-se para o próximo racha.';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  const today = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const date = new Date(`${round.date}T00:00:00Z`);
  const days = (date.getTime() - today) / 86400000;
  if (!Number.isFinite(days) || days < 0) return 'Confira a rodada.';
  if (days === 0) return 'Hoje tem Fortalaka!';
  if (days === 1) return 'Amanhã tem racha.';
  if (days >= 7) return `Racha em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(date)}.`;
  return `${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getUTCDay()]} tem racha.`;
}
