// Adapter somente para PostgreSQL isolado: usa invalidação real e transporte
// de eventos local. Não acessa endpoints nem credenciais do Supabase.
import { invalidateLive } from '../src/lib/live/refresh.ts';
import { mutationDomains } from '../src/lib/live/transport.ts';

export function createFixtureClient(base, role) {
  async function request(body, signal) {
    const domains = body.kind === 'rpc' ? mutationDomains('https://fixture.invalid/rest/v1/rpc/' + body.name, 'POST')
      : body.kind === 'table' && body.op !== 'select' ? mutationDomains('https://fixture.invalid/rest/v1/' + body.table, 'POST') : [];
    if (domains.length) invalidateLive(domains);
    try { const r = await fetch(base + '/api', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, role }) }); return await r.json(); }
    finally { if (domains.length) invalidateLive(domains); }
  }
  return {
    rpc(name, args) { let signal; const q = { abortSignal(s) { signal = s; return q; }, then(a, b) { return request({ kind: 'rpc', name, args }, signal).then(a, b); } }; return q; },
    from(table) {
      const body = { kind: 'table', table, op: 'select', filters: [], single: false }; let signal;
      const q = {
        select(columns, options) { body.columns = columns; body.count = options?.count; return q; }, eq(k, v) { body.filters.push([k, v]); return q; },
        is(k, v) { body.filters.push([k, v]); return q; },
        order(k, o) { (body.orders ??= []).push([k, o]); return q; }, range(from, to) { body.range = [from, to]; return q; }, limit(n) { body.limit = n; return q; },
        returns() { return q; }, maybeSingle() { body.single = true; return q; }, single() { body.single = true; return q; },
        insert(value) { body.op = 'insert'; body.value = value; return q; }, update(value) { body.op = 'update'; body.value = value; return q; }, delete() { body.op = 'delete'; return q; },
        abortSignal(s) { signal = s; return q; }, then(a, b) { return request(body, signal).then(a, b); },
      }; return q;
    },
    channel() {
      const handlers = []; const controller = new AbortController();
      const channel = {
        on(_event, filter, handler) { handlers.push({ filter, handler }); return channel; },
        subscribe(status) {
          void fetch(base + '/test/events', { signal: controller.signal }).then(async response => {
            status('SUBSCRIBED'); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
            for (;;) {
              const { done, value } = await reader.read(); if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let boundary;
              while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                const message = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
                if (!message.startsWith('data: ')) continue;
                const table = JSON.parse(message.slice(6));
                for (const { filter, handler } of handlers) if (table === '*' || filter.table === table) handler();
              }
            }
            if (!controller.signal.aborted) status('CLOSED');
          }).catch(() => { if (!controller.signal.aborted) status('CHANNEL_ERROR'); });
          return channel;
        }, close() { controller.abort(); },
      }; return channel;
    },
    async removeChannel(channel) { channel.close(); },
    auth: { async getUser() { const r = await request({ kind: 'user' }); return { data: { user: r.data }, error: r.error }; } },
    storage: { from() { return {
      async upload(path, file) { const bytes = new Uint8Array(await file.arrayBuffer()); let text = ''; for (const b of bytes) text += String.fromCharCode(b); return request({ kind: 'upload', path, type: file.type, base64: btoa(text) }); },
      getPublicUrl(path) { return { data: { publicUrl: base + '/avatar/' + path } }; }, remove(paths) { return request({ kind: 'remove', paths }); },
    }; } },
  };
}
