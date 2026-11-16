import { ALL_DOMAINS, type Domain } from './cache';
import { invalidateLive, TABLE_DOMAINS } from './refresh';

export function mutationDomains(url: string, method: string): readonly Domain[] {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return [];
  const path = new URL(url).pathname;
  if (!path.startsWith('/rest/v1/')) return [];
  const resource = path.slice('/rest/v1/'.length);
  if (resource.startsWith('rpc/')) {
    const name = resource.slice(4);
    if (/^(ler_|avatars_da_rodada$|medias_jogador$|push_ativo$|chave_publica_push$)/.test(name)) return [];
    return ALL_DOMAINS;
  }
  return TABLE_DOMAINS[resource] ?? ALL_DOMAINS;
}

// Não cacheia transporte nem confirma mutações por dados locais. Toda gravação
// invalida também quando falha: a rede pode ter caído depois do COMMIT remoto.
export async function performanceFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const domains = mutationDomains(url, init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET'));
  if (domains.length) invalidateLive(domains);
  try { return await fetch(input, init); }
  finally { if (domains.length) invalidateLive(domains); }
}
