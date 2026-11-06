// node tests/pagamentos.test.mjs <node_modules com PGlite>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const { PGlite } = createRequire(resolve(process.argv[2], 'package.json'))('@electric-sql/pglite');
const db = new PGlite();
const sql = name => readFileSync(`supabase/${name}.sql`, 'utf8');
const scalar = async (query, args = []) => Object.values((await db.query(query, args)).rows[0])[0];
const rows = async (query, args = []) => (await db.query(query, args)).rows;
const actor = randomUUID(), other = randomUUID(), admin = randomUUID(), inactive = randomUUID();
const round = randomUUID(), legacyRound = randomUUID();
async function user(id, role = 'authenticated') {
  await db.exec(`reset role; set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
}
const join = (method = null, id = round) => db.query('select public.inscricao_rodada($1,null,true,$2)', [id, method]);
const leave = () => db.query('select public.inscricao_rodada($1,null,false)', [round]);
const participant = () => scalar('select id from public.racha_participantes where racha_id=$1 and jogador_id=$2', [round, actor]);
const pay = (id, status, amount) => db.query('select public.atualizar_pagamento($1,$2,$3)', [id, status, amount]);
const method = (id, value) => db.query('select public.alterar_forma_pagamento($1,$2)', [id, value]);
const denied = action => assert.rejects(action);
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const name of ['schema', 'sorteio-times', 'validacao-sorteio-avatars', 'partidas-estatisticas', 'avaliacoes', 'finalizar-rodada', 'entrada-avaliacoes', 'fluxo-principal', 'fluxo-sem-posicoes', 'correcao-inscricao-lista']) await db.exec(sql(name));
  for (const id of [actor, other, admin, inactive]) await db.query('insert into auth.users values($1,$2,$3)', [id, 'local@example.invalid', JSON.stringify({ name: 'Teste local' })]);
  await db.query("update public.profiles set role='organizador' where id in ($1,$2)", [admin, inactive]);
  await db.query('update public.profiles set active=false where id=$1', [inactive]);
  await user(admin);
  await db.query("insert into public.rachas(id,nome,data) values($1,'Atual','2026-11-05'),($2,'Legado','2026-10-01')", [round, legacyRound]);
  await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,'Legado','goleiro'),($1,null,'Sem perfil','suplente')", [legacyRound, actor]);
  const legacy = await rows('select * from public.racha_participantes order by id');
  const indexes = await rows("select indexname,indexdef from pg_indexes where tablename='racha_participantes' order by indexname");
  const policies = await rows("select * from pg_policies where tablename='racha_participantes' order by policyname");
  const constraints = await rows("select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.racha_participantes'::regclass order by conname");
  await db.exec('reset role');
  await db.exec(sql('pagamentos'));
  assert.equal(await scalar("select count(*) from information_schema.columns where table_name='racha_participantes' and column_name='forma_pagamento'"), 1);
  await db.exec(sql('pagamentos'));
  assert.deepEqual(await rows('select * from public.racha_participantes order by id'), legacy.map(row => ({ ...row, forma_pagamento: null, status_pagamento: 'pendente', valor_pagamento: null })));
  assert.deepEqual(await rows("select indexname,indexdef from pg_indexes where tablename='racha_participantes' order by indexname"), indexes);
  assert.deepEqual(await rows("select * from pg_policies where tablename='racha_participantes' order by policyname"), policies);
  const preservedConstraints = await rows("select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.racha_participantes'::regclass and conname=any($1::text[]) order by conname", [constraints.map(c => c.conname)]);
  assert.deepEqual(preservedConstraints, constraints);
  assert.equal(await scalar("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='inscricao_rodada'"), 1);
  console.log('PASS migration rerunnable; legacy, indexes, participant RLS and single RPC signature preserved');

  await user(actor);
  for (const value of [null, '', 'cartao', 'PIX', ' pix ']) await assert.rejects(() => join(value), /Escolha Pix ou dinheiro/);
  await assert.rejects(() => db.query('select public.inscricao_rodada($1,null,true)', [round]), /Escolha Pix ou dinheiro/);
  await assert.rejects(() => db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,'Teste','linha')", [round, actor]), /Escolha Pix ou dinheiro/);
  await assert.rejects(() => db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,forma_pagamento,status_pagamento,valor_pagamento) values($1,$2,'Teste','linha','pix','recebido',10)", [round, actor]), /Novas inscricoes devem iniciar/);
  await join('pix');
  const id = await participant();
  const original = (await rows('select * from public.racha_participantes where id=$1', [id]))[0];
  await Promise.all([join('pix'), join('pix')]);
  assert.equal(await scalar('select count(*) from public.racha_participantes where racha_id=$1', [round]), 1);
  await method(id, 'dinheiro');
  await leave(); await join('pix');
  const rejoined = (await rows('select * from public.racha_participantes where id=$1', [id]))[0];
  assert.equal(rejoined.id, original.id); assert.deepEqual(rejoined.created_at, original.created_at);
  assert.equal(rejoined.status_pagamento, 'pendente'); assert.equal(rejoined.valor_pagamento, null);
  await user(other); await join('dinheiro');
  await denied(() => method(id, 'pix'));
  const orderedIds = await rows('select id,created_at from public.racha_participantes where racha_id=$1 order by created_at,id', [round]);
  await user(actor);
  for (const field of ["status_pagamento='recebido',valor_pagamento=10", 'valor_pagamento=0', 'forma_pagamento=null', "created_at=now()+interval '1 day'"]) await denied(() => db.query(`update public.racha_participantes set ${field} where id=$1`, [id]));
  await denied(() => pay(id, 'recebido', 10));
  await db.query("select set_config('app.pagamentos_autorizado','true',false)");
  await denied(() => db.query('update public.racha_participantes set valor_pagamento=10 where id=$1', [id]));
  console.log('PASS required canonical method, direct/RPC guards, leave/rejoin, repeated requests, identity/order, member tampering');

  await user(admin);
  for (const financial of ["'recebido',10", "'pendente',10"]) await assert.rejects(() => db.query(`insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,forma_pagamento,status_pagamento,valor_pagamento) values($1,$2,'Admin','linha','pix',${financial})`, [round, admin]), /Novas inscricoes devem iniciar/);
  await join('dinheiro');
  const adminId = await scalar('select id from public.racha_participantes where racha_id=$1 and jogador_id=$2', [round, admin]);
  assert.equal(await scalar('select status_pagamento from public.racha_participantes where id=$1', [adminId]), 'pendente');
  await pay(adminId, 'recebido', 8); await join('pix');
  assert.equal(await scalar('select valor_pagamento from public.racha_participantes where id=$1', [adminId]), '8.00');
  assert.equal(await scalar('select status_pagamento from public.racha_participantes where id=$1', [adminId]), 'recebido');
  const precisionState = {
    participants: await rows('select * from public.racha_participantes order by id'),
    rounds: await rows('select * from public.rachas order by id'),
  };
  for (const status of ['recebido', 'pendente']) {
    await assert.rejects(() => pay(id, status, 12.345), error => error.code === 'P0001' && error.message === 'Informe um status e um valor de pagamento validos.');
    assert.deepEqual(await rows('select * from public.racha_participantes order by id'), precisionState.participants);
    assert.deepEqual(await rows('select * from public.rachas order by id'), precisionState.rounds);
  }
  for (const [status, value] of [['recebido', null], ['recebido', -1], ['x', 1], [null, 1], ['recebido', 'NaN'], ['recebido', 'Infinity'], ['recebido', 100000000]]) await denied(() => pay(id, status, value));
  await pay(id, 'recebido', 12.5);
  await user(actor); await join('dinheiro'); await leave(); await join('pix');
  assert.equal(await scalar('select valor_pagamento from public.racha_participantes where id=$1', [id]), '12.50');
  assert.equal(await scalar('select status_pagamento from public.racha_participantes where id=$1', [id]), 'recebido');
  assert.deepEqual(await rows('select id,created_at from public.racha_participantes where racha_id=$1 order by created_at,id', [round]), orderedIds.concat(await rows('select id,created_at from public.racha_participantes where id=$1', [adminId])).sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)));
  await user(admin);
  // Legacy null method permits financial bookkeeping, but not reactivation without a method.
  const legacyId = await scalar('select id from public.racha_participantes where jogador_id=$1 and racha_id=$2', [actor, legacyRound]);
  await pay(legacyId, 'recebido', 0);
  assert.equal(await scalar('select forma_pagamento from public.racha_participantes where id=$1', [legacyId]), null);
  await db.query("update public.racha_participantes set status='removido' where id=$1", [legacyId]);
  await denied(() => db.query("update public.racha_participantes set status='confirmado' where id=$1", [legacyId]));
  await db.query("update public.racha_participantes set status='confirmado',forma_pagamento='dinheiro' where id=$1", [legacyId]);
  await db.query("select public.alterar_estado_rodada($1,'lista_fechada')", [legacyRound]);
  await assert.rejects(() => db.query("insert into public.racha_participantes(racha_id,nome,tipo) values($1,'Reserva sem metodo','suplente')", [legacyRound]), /Escolha Pix ou dinheiro/);
  const closedReserve = (await rows("insert into public.racha_participantes(racha_id,nome,tipo,forma_pagamento) values($1,'Reserva administrativa','suplente','dinheiro') returning *", [legacyRound]))[0];
  assert.equal(closedReserve.status_pagamento, 'pendente');
  assert.equal(closedReserve.valor_pagamento, null);
  assert.equal(await scalar('select estado from public.rachas where id=$1', [legacyRound]), 'lista_fechada');
  await db.query("update public.racha_participantes set status='ausente' where id=$1", [closedReserve.id]);
  await assert.rejects(() => method(closedReserve.id, 'pix'), /A lista esta fechada/);
  await assert.rejects(() => db.query("update public.racha_participantes set forma_pagamento='pix' where id=$1", [closedReserve.id]), /A lista esta fechada/);

  await db.query("select public.alterar_estado_rodada($1,'lista_fechada')", [round]);
  const ids = (await rows('select id from public.racha_participantes where racha_id=$1 order by created_at,id', [round])).map(p => p.id);
  await db.query('select public.salvar_rascunho_times($1,$2,$3)', [round, await scalar('select versao from public.rachas where id=$1', [round]), JSON.stringify([{ numero: 1, nome: 'Time', jogadores: ids }])]);
  await db.query('select public.confirmar_rascunho_times($1,$2)', [round, await scalar('select versao from public.rachas where id=$1', [round])]);
  const snapshot = async () => ({
    round: await rows('select * from public.rachas where id=$1', [round]),
    teams: await rows('select * from public.times where racha_id=$1 order by id', [round]),
    players: await rows('select * from public.time_jogadores order by id'),
    queue: await rows('select * from public.fila_times order by racha_id'),
    roster: await rows('select id,racha_id,jogador_id,nome,tipo,status,created_at from public.racha_participantes order by id'),
  });
  for (const state of ['times_confirmados', 'lista_fechada', 'em_andamento', 'finalizado']) {
    // Isolated fixture only: exercise each state without fabricating real matches.
    await db.exec('reset role'); await db.query('update public.rachas set estado=$1 where id=$2', [state, round]); await user(admin);
    const before = await snapshot();
    await pay(id, 'recebido', 22.75); await pay(id, 'pendente', null);
    await db.query("update public.racha_participantes set status_pagamento='recebido',valor_pagamento=5 where id=$1", [id]);
    assert.deepEqual(await snapshot(), before);
    await denied(() => method(id, 'dinheiro'));
    if (state === 'finalizado') {
      for (const field of ["nome='Invadido'", "tipo='suplente'", "status='removido'", "created_at=now()+interval '1 day'", 'jogador_id=null', 'id=gen_random_uuid()', 'racha_id=gen_random_uuid()']) await denied(() => db.query(`update public.racha_participantes set status_pagamento='pendente',${field} where id=$1`, [id]));
      await denied(() => db.query('delete from public.racha_participantes where id=$1', [id]));
    }
    await user(actor); await denied(() => join('pix')); await denied(() => method(id, 'dinheiro')); await denied(() => pay(id, 'recebido', 10));
    await user(admin);
  }
  await db.exec('reset role'); await db.query("update public.rachas set estado='aberto' where id=$1", [round]); await user(actor);
  const beforeMethod = await snapshot(); await method(id, 'dinheiro');
  assert.deepEqual(await snapshot(), beforeMethod);
  await db.query("update public.racha_participantes set forma_pagamento='pix' where id=$1", [id]);
  assert.deepEqual(await snapshot(), beforeMethod);
  await user(admin); await method(id, 'pix'); assert.deepEqual(await snapshot(), beforeMethod);
  await pay(id, 'recebido', 15); assert.deepEqual(await snapshot(), beforeMethod);
  const beforeInvalid = await rows('select * from public.racha_participantes where id=$1', [id]);
  for (const fields of ["status_pagamento='recebido',valor_pagamento=null", "valor_pagamento=-1", "valor_pagamento='NaN'", "forma_pagamento='PIX'"]) await denied(() => db.query(`update public.racha_participantes set ${fields} where id=$1`, [id]));
  assert.deepEqual(await rows('select * from public.racha_participantes where id=$1', [id]), beforeInvalid);
  console.log('PASS organizer finance after closed/finalized; method-only edits preserve draw; mixed finalized edits blocked; legacy null finance');

  await user(actor);
  assert.equal(await scalar('select count(*) from public.configuracoes_pagamento'), 1);
  assert.equal((await db.query("update public.configuracoes_pagamento set banco='Outro' returning id")).rows.length, 0);
  await user(admin);
  await db.query("update public.configuracoes_pagamento set chave_pix='12345678901',titular='Titular teste',banco='Banco teste'");
  const settings = await rows('select * from public.configuracoes_pagamento');
  for (const assignment of ["chave_pix='123.456.789-01'", "chave_pix='abc'", "chave_pix=null", "titular=''", "banco=repeat('x',101)"]) await assert.rejects(() => db.query(`update public.configuracoes_pagamento set ${assignment}`), error => error.code === 'P0001' && error.message === 'Configuracao de pagamento invalida.' && error.detail === undefined);
  await assert.rejects(() => db.exec('update public.configuracoes_pagamento set id=false'), error => error.code === '42501');
  await denied(() => db.exec('delete from public.configuracoes_pagamento'));
  await denied(() => db.exec("insert into public.configuracoes_pagamento values(false,'12345678901','Teste','Banco')"));
  await denied(() => db.exec("insert into public.configuracoes_pagamento values(true,'12345678901','Teste','Banco')"));
  const beforeReapply = await rows('select * from public.racha_participantes order by id');
  await db.exec('reset role'); await db.exec(sql('pagamentos'));
  assert.deepEqual(await rows('select * from public.racha_participantes order by id'), beforeReapply);
  assert.deepEqual(await rows('select * from public.configuracoes_pagamento'), settings);
  for (const signature of ['inscricao_rodada(uuid,text,boolean,text)', 'alterar_forma_pagamento(uuid,text)', 'atualizar_pagamento(uuid,text,numeric)']) {
    assert.equal(await scalar("select has_function_privilege('authenticated',$1,'EXECUTE')", [`public.${signature}`]), true);
    assert.equal(await scalar("select has_function_privilege('anon',$1,'EXECUTE')", [`public.${signature}`]), false);
    const metadata = (await rows("select prosecdef,exists(select 1 from unnest(proconfig) setting where replace(setting,' ','')='search_path=public,pg_temp') as pinned,exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a where grantee=0 and privilege_type='EXECUTE') as public_execute from pg_proc where oid=$1::regprocedure", [`public.${signature}`]))[0];
    assert.deepEqual(metadata, { prosecdef: true, pinned: true, public_execute: false });
  }
  assert.deepEqual((await rows("select tgname from pg_trigger where tgrelid='public.racha_participantes'::regclass and not tgisinternal order by tgname")).map(t => t.tgname), ['proteger_lista_sorteio', 'set_racha_participantes_updated_at']);
  await denied(() => db.exec('delete from public.configuracoes_pagamento'));
  for (const [uid, role] of [[inactive, 'authenticated'], [null, 'authenticated'], [null, 'anon']]) {
    await user(uid, role);
    if (role === 'anon') await denied(() => db.exec('select * from public.configuracoes_pagamento'));
    else {
      assert.equal(await scalar('select count(*) from public.configuracoes_pagamento'), 0);
      assert.equal((await db.query("update public.configuracoes_pagamento set banco='Nao' returning id")).rows.length, 0);
    }
    await denied(() => join('pix')); await denied(leave); await denied(() => method(id, 'pix')); await denied(() => pay(id, 'recebido', 10));
    await denied(() => db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,forma_pagamento) values($1,$2,'Inativo','linha','pix')", [round, uid]));
    await db.query("update public.racha_participantes set valor_pagamento=99 where id=$1", [id]).then(result => assert.equal(result.affectedRows, 0), () => {});
  }
  await db.exec('reset role'); await db.query('update public.profiles set active=false where id=$1', [actor]); await user(actor);
  await denied(() => method(id, 'pix')); await denied(() => join('pix'));
  await denied(() => db.query("update public.racha_participantes set forma_pagamento='dinheiro' where id=$1", [id]));
  console.log('PASS settings RLS/privileges/validation/singleton/edited seed; inactive organizer, unauthenticated and anon denied');
} finally { await db.close(); }
