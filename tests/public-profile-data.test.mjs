// Run: node tests/public-profile-data.test.mjs C:/tmp/fortalaka-ui-check/node_modules
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.ok(process.argv[2], 'Pass the dependency node_modules directory as argv[2]');
const { build } = createRequire(resolve(process.argv[2], 'package.json'))('esbuild');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({
  absWorkingDir: root,
  stdin: {
    contents: `export { getPublicPlayer, validPlayerId } from './src/lib/players/public-profile.ts';
      export { state } from 'profile-test-state';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: 'public-profile-fixture',
    setup(build) {
      build.onResolve({ filter: /^(profile-test-state|@\/lib\/matches\/repository|@\/lib\/supabase\/client)$/ },
        ({ path }) => ({ path, namespace: 'profile-fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'profile-fixture' }, ({ path }) => ({
        contents: path === 'profile-test-state'
          ? 'export const state = {};'
          : path === '@/lib/matches/repository'
            ? `import { state } from 'profile-test-state';
               export const getPlayerStatistics = (...args) => state.statistics(...args);`
            : `import { state } from 'profile-test-state';
               export const createClient = () => { state.clients++; return {
                 rpc: (...args) => state.rpc(...args)
               }; };`,
        loader: 'js',
      }));
    },
  }],
});
const { getPublicPlayer, validPlayerId, state } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const id = 'abcdef12-3456-4789-abcd-0123456789ab';
const otherId = '12345678-1234-4567-890a-123456789abc';
const statistics = {
  jogador_id: id, nome: 'Jogador teste', avatar_url: 'https://example.invalid/avatar.png',
  jogos: 7, gols: 4, assistencias: 3, vitorias: 5,
  nota_geral_100: 80, quantidade_avaliacoes: 2,
  email: 'private@example.invalid', role: 'organizador', internal: 'secret', extra: 'private',
};
const attributes = {
  quantidade: 2, passe: 4, chute: 3, velocidade: 5, defesa: 4, fisico: 4,
};
const publicStatistics = {
  nome: statistics.nome, avatar_url: statistics.avatar_url,
  jogos: 7, gols: 4, assistencias: 3, vitorias: 5, nota_geral_100: 80,
};

function fixture({ rows = [statistics], data = [attributes], error = null, reject = false } = {}) {
  const calls = { statistics: [], rpc: [] };
  state.clients = 0;
  state.statistics = async (...args) => { calls.statistics.push(args); return rows; };
  state.rpc = async (...args) => {
    calls.rpc.push(args);
    if (reject) throw new Error('Attribute service unavailable');
    return { data, error };
  };
  return calls;
}

let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

await check('invalid UUIDs return null without statistics, client creation or RPC', async () => {
  const calls = fixture();
  assert.equal(validPlayerId(id), true);
  assert.equal(validPlayerId(id.toUpperCase()), true);
  for (const invalid of ['', 'not-a-uuid', id.slice(1), `${id}0`, ` ${id}`, `${id} `, id.replace('a', 'g')]) {
    assert.equal(validPlayerId(invalid), false, invalid);
    for (const allowed of [false, true]) assert.equal(await getPublicPlayer(invalid, allowed), null);
  }
  assert.deepEqual(calls, { statistics: [], rpc: [] });
  assert.equal(state.clients, 0);
});

await check('restricted profile requests only target statistics and never creates an attribute client', async () => {
  const calls = fixture({ rows: [{ ...statistics, jogador_id: otherId, nome: 'Outro' }, statistics] });
  assert.deepEqual(await getPublicPlayer(id, false), {
    ...publicStatistics, summary: null, ratingsRestricted: true, ratingsUnavailable: false,
  });
  assert.deepEqual(calls.statistics, [[id]]);
  assert.deepEqual(calls.rpc, []);
  assert.equal(state.clients, 0);
});

await check('missing player never falls back to another player', async () => {
  for (const rows of [[], [{ ...statistics, jogador_id: otherId }]]) {
    for (const allowed of [false, true]) {
      const calls = fixture({ rows });
      assert.equal(await getPublicPlayer(id, allowed), null);
      assert.deepEqual(calls.statistics, [[id]]);
      assert.equal(calls.rpc.length, allowed ? 1 : 0);
    }
  }
});

await check('authorized attributes use exactly one medias_jogador call with the target id', async () => {
  const calls = fixture();
  assert.deepEqual(await getPublicPlayer(id, true), {
    ...publicStatistics, summary: attributes, ratingsRestricted: false, ratingsUnavailable: false,
  });
  assert.deepEqual(calls.statistics, [[id]]);
  assert.deepEqual(calls.rpc, [['medias_jogador', { p_jogador: id }]]);
  assert.equal(state.clients, 1);
});

await check('the two reads start concurrently, once each, within a bounded wait', async () => {
  fixture();
  const calls = [];
  let releaseStatistics, releaseAttributes, bothStarted, timer;
  const started = new Promise(resolve => { bothStarted = resolve; });
  const record = call => { calls.push(call); if (calls.length === 2) bothStarted(); };
  state.statistics = (...args) => {
    record(['statistics', ...args]);
    return new Promise(resolve => { releaseStatistics = () => resolve([statistics]); });
  };
  state.rpc = (...args) => {
    record(['rpc', ...args]);
    return new Promise(resolve => { releaseAttributes = () => resolve({ data: [attributes], error: null }); });
  };
  const pending = getPublicPlayer(id, true);
  try {
    await Promise.race([started, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Reads did not start concurrently within 1000ms')), 1000);
    })]);
    assert.deepEqual(calls, [
      ['statistics', id], ['rpc', 'medias_jogador', { p_jogador: id }],
    ]);
    assert.equal(state.clients, 1);
  } finally {
    clearTimeout(timer);
    releaseStatistics?.();
    // Let a sequential implementation start its second read before cleanup.
    await Promise.resolve();
    releaseAttributes?.();
    await pending;
  }
});

await check('overall and radar each require at least two responses', async () => {
  for (const count of [0, 1, 2, 3, '1', '2']) {
    fixture({ rows: [{ ...statistics, quantidade_avaliacoes: count }], data: [{ ...attributes, quantidade: count }] });
    const result = await getPublicPlayer(id, true);
    assert.equal(result.nota_geral_100, Number(count) >= 2 ? 80 : null);
    assert.deepEqual(result.summary, Number(count) >= 2 ? { ...attributes, quantidade: Number(count) } : null);
  }
  fixture({ rows: [{ ...statistics, quantidade_avaliacoes: 1 }] });
  assert.equal((await getPublicPlayer(id, true)).nota_geral_100, null);
  fixture({ data: [{ ...attributes, quantidade: 1 }] });
  assert.equal((await getPublicPlayer(id, true)).summary, null);
});

await check('public projection whitelists statistics and attributes, stripping private extras', async () => {
  fixture({ data: [{ ...attributes, email: statistics.email, role: 'organizador', internal: 'secret', extra: 42, jogador_id: id }] });
  assert.deepEqual(await getPublicPlayer(id, true), {
    ...publicStatistics, summary: attributes, ratingsRestricted: false, ratingsUnavailable: false,
  });
});

await check('attribute RPC errors and rejected promises preserve safe statistics', async () => {
  for (const failure of [{ error: { message: 'denied' } }, { reject: true }]) {
    const calls = fixture(failure);
    assert.deepEqual(await getPublicPlayer(id, true), {
      ...publicStatistics, summary: null, ratingsRestricted: false, ratingsUnavailable: true,
    });
    assert.deepEqual(calls.statistics, [[id]]);
    assert.deepEqual(calls.rpc, [['medias_jogador', { p_jogador: id }]]);
  }
});

await check('null or absent attribute rows are safe', async () => {
  for (const data of [null, [], [null]]) {
    fixture({ data });
    assert.deepEqual(await getPublicPlayer(id, true), {
      ...publicStatistics, summary: null, ratingsRestricted: false, ratingsUnavailable: false,
    });
  }
});

await check('null, missing and non-finite attribute values remain null, numeric strings normalize', async () => {
  fixture({ data: [{ quantidade: '2', passe: null, chute: undefined, velocidade: 'invalid', defesa: Infinity, fisico: '4' }] });
  assert.deepEqual((await getPublicPlayer(id, true)).summary, {
    quantidade: 2, passe: null, chute: null, velocidade: null, defesa: null, fisico: 4,
  });
});

console.log(`${checks} public profile checks passed`);
