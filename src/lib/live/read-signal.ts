// Os clientes reais Supabase suportam abortSignal; fixtures podem ser thenables.
export function withReadSignal<T>(query: T, signal?: AbortSignal): T {
  const abortable = query as T & { abortSignal?: (signal: AbortSignal) => T };
  return signal && abortable.abortSignal ? abortable.abortSignal(signal) : query;
}
