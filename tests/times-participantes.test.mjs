// node tests/times-participantes.test.mjs <diretório com esbuild>
// Repositórios reais, respostas isoladas; nenhuma escrita no Supabase remoto.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const { build } = createRequire(resolve(process.argv[2], 'package.json'))('esbuild');
const outfile = join(mkdtempSync(join(tmpdir(), 'fortalaka-times-test-')), 'repository.cjs');
await build({
  entryPoints: [resolve('src/lib/teams/repository.ts')], outfile, bundle: true, platform: 'node',
  tsconfig: resolve('tsconfig.json'), plugins: [{ name: 'no-remote-client', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function createClient(){throw Error("Cliente remoto proibido neste teste");}', loader: 'js' }));
  } }],
});
const { getCurrentRoundTeamsState } = createRequire(import.meta.url)(outfile);
const participants = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, jogador_id: `u${i}`, nome: `Jogador ${i}`, tipo: i === 0 ? 'goleiro' : 'linha', status: 'confirmado' }));
participants.push({ id: 'ausente', jogador_id: 'u-a', nome: 'Ausente', tipo: 'linha', status: 'ausente' });
participants.push({ id: 'reserva', jogador_id: 'u-r', nome: 'Reserva', tipo: 'suplente', status: 'confirmado' });
const calls = [];
let status = 'aberto';
let rpcError = null;
let participantError = null;
let rpcRoundId = 'round';
let roundExists = true;
const savedTeams = [{ id: 'persisted', name: 'Time 1', number: 1, players: [] }];
const client = {
  from(table) {
    const q = {
      select(fields) { calls.push({ table, fields }); return q; },
      order() { return q; }, limit() { return q; },
      eq(key, value) { calls.push({ table, key, value }); return q; },
      maybeSingle: async () => ({ data: roundExists ? { id: 'round', nome: 'Rodada', estado: status } : null, error: null }),
      returns: async () => ({ data: participants, error: participantError }),
    };
    return q;
  },
  async rpc(name) {
    calls.push({ rpc: name });
    if (name === 'avatars_da_rodada') return { data: [{ jogador_id: 'u0', avatar_url: 'https://example.invalid/foto.png' }], error: null };
    assert.equal(name, 'ler_times_rodada');
    return { data: { roundId: rpcRoundId, status, fieldPlayers: [], teams: savedTeams, version: 9, confirmed: false }, error: rpcError };
  },
};

for (const state of ['aberto', 'lista_fechada', 'times_confirmados', 'finalizado']) {
  status = state;
  const result = await getCurrentRoundTeamsState(client);
  assert.equal(result.fieldPlayers.length, 6, 'Contagem independe de estado e de fieldPlayers vazio na RPC');
  assert(result.fieldPlayers.some(p => p.type === 'goleiro'), 'Tipo legado continua elegível sem posição especial');
  assert.equal(result.fieldPlayers[0].avatarUrl, 'https://example.invalid/foto.png');
  assert.deepEqual(result.teams, savedTeams, 'Não recriar ou substituir times persistidos');
  assert.equal(result.version, 9);
  assert.equal(result.status, state);
}
assert(calls.some(c => c.table === 'racha_participantes' && c.key === 'racha_id' && c.value === 'round'));
assert(!calls.some(c => c.key === 'tipo'), 'Não filtrar pelo tipo linha na consulta');
participantError = new Error('Falha de RLS');
await assert.rejects(() => getCurrentRoundTeamsState(client), /Falha de RLS/);
participantError = null; rpcError = { message: 'RPC indisponível' };
await assert.rejects(() => getCurrentRoundTeamsState(client), /RPC indisponível/);
rpcError = null; rpcRoundId = 'outra-rodada';
await assert.rejects(() => getCurrentRoundTeamsState(client), /rodada mudou/);
rpcRoundId = 'round'; roundExists = false;
assert.equal(await getCurrentRoundTeamsState(client), null);
console.log('PASS seis confirmados com RPC vazia, estados, legado, fotos, times persistidos, identidade e erros explícitos');
