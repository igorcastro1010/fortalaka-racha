// PostgreSQL isolado (PGlite). Não acessa Supabase nem altera dados reais.
// Passe o diretório node_modules onde @electric-sql/pglite está instalado.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(resolve(process.argv[2], 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`);
await db.exec(readFileSync('supabase/schema.sql', 'utf8'));
const migration = readFileSync('supabase/sorteio-times.sql', 'utf8');
await db.exec(migration);
await db.exec(migration); // Reexecução não destrói a estrutura.
const organizer = randomUUID(), player = randomUUID(), inactive = randomUUID();
for (const [id, role, active] of [[organizer, 'organizador', true], [player, 'jogador', true], [inactive, 'organizador', false]]) {
  await db.query("insert into auth.users values ($1, 'test@example.invalid', '{\"name\":\"Teste\"}')", [id]);
  await db.query('update public.profiles set role=$2, active=$3 where id=$1', [id, role, active]);
}
const roster = [
  ...Array.from({ length: 20 }, (_, i) => ({ id: randomUUID(), name: `Linha ${i}`, tipo: 'linha', status: 'presente' })),
  ...[1, 2].map(i => ({ id: randomUUID(), name: `Goleiro ${i}`, tipo: 'goleiro_fixo', status: 'presente' })),
  { id: randomUUID(), name: 'Suplente', tipo: 'suplente', status: 'presente' },
  { id: randomUUID(), name: 'Ausente', tipo: 'linha', status: 'ausente' },
  { id: randomUUID(), name: 'Removido', tipo: 'linha', status: 'removido' },
];
const teams = Array.from({ length: 4 }, (_, i) => ({ numero: i + 1, nome: `Time ${i + 1}`, cor: null, jogadores: roster.slice(i * 5, i * 5 + 5).map(p => p.id) }));
async function asUser(id, role = 'authenticated') {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
await asUser(organizer);
const { rows: [{ id: round }] } = await db.query("select public.criar_rodada('Rodada teste', '2026-10-08') as id");
await db.query('select public.salvar_participantes($1, 0, $2)', [round, JSON.stringify(roster)]);
async function confirm(payload = teams, version = 1) {
  return db.query('select public.confirmar_times($1, $2, $3)', [round, version, JSON.stringify(payload)]);
}
let passed = 0;
async function check(name, fn) {
  await db.exec('begin');
  try { await fn(); console.log(`PASS ${name}`); passed++; }
  finally { await db.exec('rollback'); await asUser(organizer); }
}
try {
  await check('confirma 4 times de 5, persiste IDs da rodada e jogador pode consultar', async () => {
    await confirm();
    await asUser(player);
    const { rows: [{ result }] } = await db.query('select public.ler_sorteio($1) as result', [round]);
    assert.equal(result.rodada.confirmado, true);
    assert.deepEqual(result.times.map(t => t.jogadores.length), [5, 5, 5, 5]);
    assert.equal(new Set(result.times.flatMap(t => t.jogadores)).size, 20);
    assert.equal(result.participantes.filter(p => p.tipo === 'goleiro_fixo').length, 2);
  });
  for (const [label, replacement] of [
    ['goleiro', roster[20].id], ['suplente', roster[22].id], ['ausente', roster[23].id],
    ['removido', roster[24].id], ['duplicado', teams[1].jogadores[0]], ['outra rodada', randomUUID()],
  ]) {
    await check(`rejeita ${label} na confirmação`, async () => {
      const bad = structuredClone(teams); bad[0].jogadores[0] = replacement;
      await assert.rejects(confirm(bad));
    });
  }
  for (const count of [19, 21]) {
    await check(`bloqueia ${count} jogadores de linha`, async () => {
      const modified = structuredClone(roster);
      if (count === 19) modified[0].status = 'ausente';
      else modified.push({ id: randomUUID(), name: 'Extra', tipo: 'linha', status: 'presente' });
      await db.query('select public.salvar_participantes($1, 1, $2)', [round, JSON.stringify(modified)]);
      await assert.rejects(confirm(teams, 2), new RegExp(count === 19 ? 'São necessários 20' : 'mais de 20'));
    });
  }
  await check('não confirma times com 4 e 6 jogadores', async () => {
    const bad = structuredClone(teams); bad[1].jogadores.push(bad[0].jogadores.pop());
    await assert.rejects(confirm(bad), /exatamente 5/);
  });
  await check('jogador comum não lê rascunho, não escreve tabela nem chama RPC de gestão', async () => {
    await asUser(player);
    const { rows: [{ result }] } = await db.query('select public.ler_sorteio($1) as result', [round]);
    assert.deepEqual(result.times, []);
    await assert.rejects(confirm(), /Somente organizadores/);
  });
  await check('não permite escrita direta mesmo por organizador', async () => {
    await assert.rejects(db.query("insert into public.times(rodada_id, nome, numero) values ($1, 'Time 1', 1)", [round]), /permission denied/);
  });
  await check('organizador inativo não pode confirmar', async () => {
    await asUser(inactive); await assert.rejects(confirm(), /Somente organizadores/);
  });
  await check('rejeita versão antiga sem substituir confirmação atual', async () => {
    await confirm();
    await assert.rejects(confirm(), /A rodada foi alterada/);
  });
  await check('alterar participantes invalida times e incremento protege contra concorrência', async () => {
    await confirm();
    await db.query('select public.salvar_participantes($1, 2, $2)', [round, JSON.stringify(roster)]);
    const { rows: [{ result }] } = await db.query('select public.ler_sorteio($1) as result', [round]);
    assert.equal(result.rodada.confirmado, false); assert.deepEqual(result.times, []); assert.equal(result.rodada.versao, 3);
  });
  console.log(`${passed} verificações SQL passaram.`);
} finally { await db.close(); }
