// Isolated PostgreSQL only: node tests/push-sql.test.mjs <external node_modules>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const deps = process.argv[2] ?? 'node_modules';
const { PGlite } = createRequire(resolve(deps, 'package.json'))('@electric-sql/pglite');
const db = new PGlite();
const sql = name => readFileSync(new URL(`../supabase/${name}.sql`, import.meta.url), 'utf8');
const rows = async (query, args = []) => (await db.query(query, args)).rows;
const scalar = async (query, args = []) => Object.values((await rows(query, args))[0])[0];
const a = randomUUID(), b = randomUUID(), inactive = randomUUID(), admin = randomUUID(), round = randomUUID();
const key = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url');
const secret = Buffer.alloc(16, 2).toString('base64url');
const endpoint = 'https://fcm.googleapis.com/fcm/send/local-fixture';
async function role(name = 'postgres', uid = '') {
  await db.exec(`reset role; set role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
const register = (url = endpoint, k = key, auth = secret) => scalar('select public.registrar_push($1,$2,$3)', [url, k, auth]);
const claim = (limit = 50) => rows('select * from public.reclamar_push($1)', [limit]);
const finish = (delivery, result) => scalar('select public.finalizar_push($1,$2,$3)', [delivery.id, delivery.claim_token, result]);
async function notify(uid = a) {
  await role();
  return scalar("insert into public.notifications(recipient_id,event_key,title,body,destination,round_id) values($1,$2,'Aviso','Mensagem generica','racha',$3) returning id", [uid, randomUUID(), round]);
}
async function due(id) {
  await role();
  await db.query("update public.push_deliveries set next_attempt_at=now()-interval '1 second' where id=$1", [id]);
  await role('service_role');
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const name of ['schema', 'sorteio-times', 'validacao-sorteio-avatars', 'partidas-estatisticas', 'avaliacoes', 'finalizar-rodada', 'entrada-avaliacoes', 'fluxo-principal', 'fluxo-sem-posicoes', 'correcao-inscricao-lista', 'pagamentos', 'notificacoes']) await db.exec(sql(name));
  for (const id of [a, b, inactive, admin]) await db.query('insert into auth.users values($1,$2,$3)', [id, 'fixture@example.invalid', JSON.stringify({ name: 'Teste' })]);
  await db.query("update public.profiles set role='organizador' where id=$1", [admin]);
  await db.query('update public.profiles set active=false where id=$1', [inactive]);
  await role('authenticated', admin);
  await db.query("insert into public.rachas(id,nome,data) values($1,'Teste push','2026-11-10')", [round]);
  await role();
  const historical = await rows('select * from public.notifications order by id');
  await db.exec(sql('web-push'));
  await db.exec(sql('web-push'));
  assert.deepEqual(await rows('select * from public.notifications order by id'), historical);
  assert.equal(await scalar('select count(*)::int from public.push_deliveries'), 0);

  await role('authenticated', a);
  const subscription = await register();
  assert.equal(await register(), subscription);
  assert.equal(await scalar('select public.push_ativo($1)', [endpoint]), true);
  for (const url of [null, '', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com:443/x',
    'https://u@fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.test/x',
    'https://evil.test/fcm.googleapis.com/x', 'https://push.services.mozilla.com/x',
    'https://notify.windows.com/x', 'https://web.push.apple.com/x#fragment',
    'https://127.0.0.1/x', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/x',
    'https://fcm.googleapis.com@127.0.0.1/x', 'https://fcm.googleapis.com./x',
    'https://fcm.googleapis.com%2e.evil.test/x', 'https://fcm.googleapis.com\\@evil.test/x',
    'https://fcm.googleapis.com/x\ny', 'https://fcm.googleapis.com/' + 'x'.repeat(2048)]) {
    await assert.rejects(() => register(url), /invalida/);
  }
  for (const k of [null, '', key.slice(1), key + 'A', 'A'.repeat(87), '='.repeat(87)]) await assert.rejects(() => register(endpoint, k), /invalida/);
  for (const k of [null, '', secret.slice(1), secret + 'A', '='.repeat(22)]) await assert.rejects(() => register(endpoint, key, k), /invalida/);
  for (const size of [64, 66]) await assert.rejects(() => register(endpoint, Buffer.concat([Buffer.from([4]), Buffer.alloc(size - 1)]).toString('base64url')), /invalida/);
  for (const size of [15, 17]) await assert.rejects(() => register(endpoint, key, Buffer.alloc(size).toString('base64url')), /invalida/);
  await assert.rejects(() => register(endpoint, Buffer.alloc(65, 5).toString('base64url')), /invalida/);
  await assert.rejects(() => register(endpoint, key.slice(0, -1) + 'B'), /invalida/);
  await assert.rejects(() => register(endpoint, key, secret.slice(0, -1) + 'B'), /invalida/);
  for (const host of ['updates.push.services.mozilla.com', 'web.push.apple.com', 'wns.notify.windows.com']) {
    const url = `https://${host}/fixture`;
    await register(url);
    assert.equal(await scalar('select public.remover_push($1)', [url]), true);
  }
  for (let device = 1; device < 10; device++) await register(endpoint + device);
  await assert.rejects(() => register(endpoint + 'overflow'), error => {
    assert.match(error.message, /Limite de dispositivos/);
    assert(!error.message.includes(endpoint));
    return true;
  });
  assert.equal(await register(), subscription);
  for (let device = 1; device < 10; device++) await scalar('select public.remover_push($1)', [endpoint + device]);
  await assert.rejects(() => db.query('insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4)', [a, endpoint + '2', key, secret]), /permission denied/);
  await assert.rejects(() => db.query('update public.push_subscriptions set auth=$1', [secret]), /permission denied/);
  await assert.rejects(() => claim(), /permission denied/);
  await assert.rejects(() => db.query('select public.finalizar_push($1,$2,$3)', [randomUUID(), randomUUID(), 'sent']), /permission denied/);
  await assert.rejects(() => db.query('select * from public.push_deliveries'), /permission denied/);
  await role('authenticated', b);
  assert.equal((await rows('select * from public.push_subscriptions')).length, 0);
  await assert.rejects(() => register(), error => {
    assert.match(error.message, /indisponivel/);
    assert(!error.message.includes(endpoint));
    return true;
  });
  assert.equal(await scalar('select public.push_ativo($1)', [endpoint]), false);
  assert.equal(await scalar('select public.remover_push($1)', [endpoint]), false);
  assert.equal((await rows('delete from public.push_subscriptions returning id')).length, 0);
  await role('authenticated', inactive);
  await assert.rejects(() => register(), /Entre/);
  assert.equal(await scalar('select public.remover_push($1)', [endpoint]), false);
  await role();
  await db.query('update public.profiles set active=true where id=$1', [inactive]);
  await role('authenticated', inactive);
  await register(endpoint + 'inactive-rpc');
  const inactiveDirect = await register(endpoint + 'inactive-delete');
  await role();
  await db.query('update public.profiles set active=false where id=$1', [inactive]);
  await role('authenticated', inactive);
  assert.equal((await rows('select * from public.push_subscriptions')).length, 0);
  assert.equal(await scalar('select public.push_ativo($1)', [endpoint + 'inactive-rpc']), false);
  assert.equal(await scalar('select public.remover_push($1)', [endpoint + 'inactive-rpc']), true);
  // An unfiltered DELETE uses owner RLS without the active-only SELECT policy.
  await db.query('delete from public.push_subscriptions');
  await role();
  assert.equal(await scalar('select count(*)::int from public.push_subscriptions where id=$1', [inactiveDirect]), 0);
  await role('authenticated', inactive);
  await assert.rejects(() => register(endpoint + 'inactive-new'), /Entre/);
  await role('anon');
  await assert.rejects(() => register(), /permission denied/);
  await assert.rejects(() => claim(), /permission denied/);
  await assert.rejects(() => db.query('select * from public.push_subscriptions'), /permission denied/);
  await role();
  for (const signature of ['public.reclamar_push(integer)', 'public.finalizar_push(uuid,uuid,text)']) {
    for (const deniedRole of ['anon', 'authenticated']) assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\')', [deniedRole, signature]), false);
    assert.equal(await scalar('select has_function_privilege(\'service_role\',$1,\'EXECUTE\')', [signature]), true);
  }
  assert.equal(await scalar(`select count(*)::int from pg_proc p, lateral aclexplode(p.proacl) acl
    where p.pronamespace='public'::regnamespace and p.proname in
    ('registrar_push','remover_push','push_ativo','reclamar_push','finalizar_push',
     'push_endpoint_valido','push_chaves_validas','enfileirar_push','notificar_pagamento_recebido')
    and acl.grantee=0 and acl.privilege_type='EXECUTE'`), 0);
  console.log('PASS idempotence, no backfill, endpoint/key validation, owner/active RLS and RPC ACLs');

  const notification = await notify();
  await notify(b);
  await notify(inactive);
  assert.equal(await scalar('select count(*)::int from public.push_deliveries'), 1);
  await assert.rejects(() => db.query('insert into public.push_deliveries(notification_id,subscription_id) values($1,$2)', [notification, subscription]), /unique/);
  await db.query('update public.profiles set active=false where id=$1', [a]);
  await notify();
  await role('service_role');
  assert.equal((await claim()).length, 0);
  await role('authenticated', a);
  assert.equal((await rows('select * from public.push_subscriptions')).length, 0);
  assert.equal(await scalar('select public.push_ativo($1)', [endpoint]), false);
  assert.equal((await rows('delete from public.push_subscriptions where endpoint=$1 returning id', [endpoint + 'missing'])).length, 0);
  await role();
  await db.query('update public.profiles set active=true where id=$1', [a]);
  await role('service_role');
  for (const limit of [null, 0, -1, 101]) await assert.rejects(() => claim(limit), /Limite/);
  const [first] = await claim(1);
  assert.deepEqual(Object.keys(first).sort(), ['id','claim_token','endpoint','p256dh','auth','notification_id','title','body','destination','round_id'].sort());
  assert.equal(first.notification_id, notification);
  assert.equal(first.endpoint, endpoint);
  assert.equal(first.round_id, round);
  await role();
  assert.equal(await scalar('select extract(epoch from (lease_until-updated_at))::int from public.push_deliveries where id=$1', [first.id]), 300);
  await role('service_role');
  assert.equal((await claim()).length, 0);
  assert.equal(await finish({ ...first, claim_token: randomUUID() }, 'sent'), false);
  await assert.rejects(() => finish(first, 'invalid'), /Resultado/);
  assert.equal(await finish(first, 'retry'), true);
  assert.equal(await finish(first, 'sent'), false);
  assert.equal((await claim()).length, 0);
  await role();
  let state = (await rows('select * from public.push_deliveries where id=$1', [first.id]))[0];
  assert.equal(state.status, 'pending');
  assert.equal(state.attempts, 1);
  assert.equal(new Date(state.next_attempt_at) - new Date(state.updated_at), 30_000);
  await due(first.id);
  const [second] = await claim();
  assert.notEqual(second.claim_token, first.claim_token);
  assert.equal(await finish(first, 'gone'), false);
  assert.equal(await finish(second, 'sent'), true);
  assert.equal((await claim()).length, 0);
  console.log('PASS opt-in only, active-at-claim, exact dispatcher contract, lease exclusion and retry fencing');

  await notify();
  await role('service_role');
  let [expired] = await claim();
  for (let attempt = 2; attempt <= 5; attempt++) {
    await role();
    await db.query("update public.push_deliveries set lease_until=now()-interval '1 second' where id=$1", [expired.id]);
    await role('service_role');
    assert.equal(await finish(expired, 'sent'), false);
    const [next] = await claim();
    assert.notEqual(next.claim_token, expired.claim_token);
    assert.equal(await finish(expired, 'gone'), false);
    expired = next;
  }
  assert.equal(await finish(expired, 'retry'), true);
  await role();
  state = (await rows('select * from public.push_deliveries where id=$1', [expired.id]))[0];
  assert.equal(state.status, 'failed');
  assert.equal(state.attempts, 5);
  await assert.rejects(() => db.query('update public.push_deliveries set attempts=6 where id=$1', [expired.id]), /check constraint/);
  await notify();
  await role('service_role');
  let [retrying] = await claim();
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal(await finish(retrying, 'retry'), true);
    await role();
    state = (await rows('select * from public.push_deliveries where id=$1', [retrying.id]))[0];
    assert.equal(state.attempts, attempt);
    assert.equal(new Date(state.next_attempt_at) - new Date(state.updated_at), 30_000 * 2 ** (attempt - 1));
    assert.equal(state.status, attempt === 5 ? 'failed' : 'pending');
    await due(retrying.id);
    const batch = await claim();
    assert.equal(batch.length, attempt === 5 ? 0 : 1);
    if (batch.length) [retrying] = batch;
  }
  await notify();
  await role('service_role');
  const [exhausted] = await claim();
  await role();
  await db.query("update public.push_deliveries set attempts=5,lease_until=now()-interval '1 second' where id=$1", [exhausted.id]);
  await role('service_role');
  assert.equal((await claim()).length, 0);
  await role();
  assert.equal(await scalar('select status from public.push_deliveries where id=$1', [exhausted.id]), 'failed');
  await notify();
  await role('service_role');
  const [renewed] = await claim();
  await role('authenticated', a);
  await register();
  await role('service_role');
  assert.equal(await finish(renewed, 'gone'), true);
  await role('authenticated', a);
  assert.equal(await scalar('select public.push_ativo($1)', [endpoint]), true);
  await notify();
  await role('service_role');
  const [gone] = await claim();
  assert.equal(await finish(gone, 'gone'), true);
  await role('authenticated', a);
  assert.equal(await scalar('select public.push_ativo($1)', [endpoint]), false);
  console.log('PASS expired lease reclaim, stale tokens, max five attempts and safe gone cleanup after renewal');

  await register();
  const staleNotification = await notify();
  await db.query("update public.notifications set created_at=now()-interval '25 hours' where id=$1", [staleNotification]);
  await role('service_role');
  assert.equal((await claim(10)).length, 0);
  await role();
  assert.equal(await scalar('select status from public.push_deliveries where notification_id=$1', [staleNotification]), 'failed');
  await role('authenticated', a);
  await db.query("select public.inscricao_rodada($1,null,true,'pix')", [round]);
  await role('authenticated', admin);
  const participant = await scalar('select id from public.racha_participantes where racha_id=$1 and jogador_id=$2', [round, a]);
  await db.query("select public.atualizar_pagamento($1,'recebido',123.45)", [participant]);
  await db.query("select public.atualizar_pagamento($1,'recebido',123.45)", [participant]);
  await db.query("select public.atualizar_pagamento($1,'pendente',null)", [participant]);
  await db.query("select public.atualizar_pagamento($1,'recebido',123.45)", [participant]);
  await role();
  const payments = await rows("select * from public.notifications where event_key like 'pagamento_recebido:%'");
  assert.equal(payments.length, 1);
  assert.equal(payments[0].recipient_id, a);
  assert.equal(payments[0].round_id, round);
  assert.equal(payments[0].title, 'Pagamento confirmado');
  assert(!/123|CPF|pix|dinheiro/i.test(payments[0].title + payments[0].body));
  await db.exec(sql('web-push'));
  assert.equal(await scalar("select count(*)::int from public.push_deliveries where status='pending'"), 1);
  await role('service_role');
  const [paid] = await claim();
  assert.equal(paid.notification_id, payments[0].id);
  assert.equal(await finish(paid, 'failed'), true);
  await role('authenticated', a);
  assert.equal((await rows('delete from public.push_subscriptions returning id')).length, 1);
  await role();
  assert.equal(await scalar('select count(*)::int from public.push_deliveries'), 0);
  assert.equal((await rows('select * from public.notifications order by id')).filter(n => historical.some(h => h.id === n.id)).length, historical.length);
  console.log('PASS real payment RPC transition, generic private payload, deduplication, reapply and owner delete cascade');
  console.log('PASS canonical decoded keys (65/16 bytes), SSRF endpoints, 300-second lease and 24-hour expiry');
  console.log('PASS ten-device cap, renewal at cap, generic errors and explicit service-only/no PUBLIC function ACLs');
  console.log('PASS inactive owner revokes through RPC/direct DELETE while reads and registration remain blocked');
} finally {
  await db.close();
}
