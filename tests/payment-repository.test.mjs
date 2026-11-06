// node tests/payment-repository.test.mjs <deps com esbuild>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const { build } = createRequire(resolve(process.argv[2], 'package.json'))('esbuild');
const output = join(mkdtempSync(join(tmpdir(), 'fortalaka-payment-data-')), 'repository.cjs');
await build({ entryPoints: ['src/lib/rounds/repository.ts'], outfile: output, bundle: true, platform: 'node', format: 'cjs', tsconfig: resolve('tsconfig.json'), plugins: [{ name: 'client', setup(b) {
  b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'test' }));
  b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function createClient(){return globalThis.__paymentClient}' }));
} }] });
const { getCurrentRoundDetails, setOwnRegistration, addRoundParticipant } = createRequire(import.meta.url)(output);
let missing = false, denied = false;
const calls = [];
globalThis.__paymentClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: [], error: null }; }, from(table) {
  let columns = '';
  const q = { select(value) { columns = value; return q; }, eq() { return q; }, order() { return q; }, limit() { return q; }, async maybeSingle() { return { data: { id: 'round', nome: 'Racha', estado: 'aberto', data: null }, error: null }; }, async returns() {
    if (denied) return { data: null, error: { code: '42501', message: 'not allowed' } };
    if (missing && columns.includes('forma_pagamento')) return { data: null, error: { code: '42703', message: 'column forma_pagamento does not exist' } };
    return { data: [{ id: 'participant', jogador_id: 'player', nome: 'Jogador', tipo: 'linha', status: 'confirmado', ...(missing ? {} : { forma_pagamento: 'dinheiro', status_pagamento: 'recebido', valor_pagamento: '12.50' }) }], error: null };
  } }; assert(['rachas', 'racha_participantes'].includes(table)); return q;
} };
const current = await getCurrentRoundDetails(globalThis.__paymentClient);
assert.equal(current.paymentsAvailable, true); assert.equal(current.participants[0].paymentMethod, 'dinheiro'); assert.equal(current.participants[0].paymentAmount, 12.5);
missing = true;
const legacy = await getCurrentRoundDetails(globalThis.__paymentClient);
assert.equal(legacy.paymentsAvailable, false); assert.equal(legacy.participants[0].paymentMethod, null); assert.equal(legacy.participants[0].paymentAmount, null);
const before = calls.length;
await assert.rejects(() => setOwnRegistration('round', true, null), /Selecione/);
await assert.rejects(() => setOwnRegistration('round', true, 'pix', false), /temporariamente/);
assert.equal(calls.length, before);
await setOwnRegistration('round', false, null, false);
assert.equal('p_forma_pagamento' in calls.at(-1).args, false);
await setOwnRegistration('round', true, 'pix'); assert.equal(calls.at(-1).args.p_forma_pagamento, 'pix');
denied = true; await assert.rejects(() => getCurrentRoundDetails(globalThis.__paymentClient), e => e.code === '42501');
let updated;
const adminClient = { from() { const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: { id: 'old', forma_pagamento: 'pix' }, error: null }; }, update(value) { updated = value; return { async eq() { return { error: null }; } }; } }; return query; } };
const input = { roundId: 'round', player: { id: 'player', name: 'Jogador' }, type: 'linha', status: 'confirmado', paymentMethod: 'dinheiro' };
await addRoundParticipant(adminClient, { ...input, listOpen: false }); assert.equal(updated.forma_pagamento, 'pix');
await addRoundParticipant(adminClient, { ...input, listOpen: true }); assert.equal(updated.forma_pagamento, 'dinheiro');
delete globalThis.__paymentClient;
console.log('PASS repositorio: campos persistidos, numeric, legado sem migration, saida compativel, entrada bloqueada sem escolha e erros de permissao nao mascarados');
