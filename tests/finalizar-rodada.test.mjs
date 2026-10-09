// Scripts reais em PostgreSQL isolado, sem acesso ao Supabase remoto.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(resolve(process.argv[2],'package.json'))('@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`);
for(const p of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql','supabase/partidas-estatisticas.sql','supabase/avaliacoes.sql','supabase/finalizar-rodada.sql','supabase/finalizar-rodada.sql'])await db.exec(readFileSync(p,'utf8'));
const organizer=randomUUID(),viewer=randomUUID(),ids=Array.from({length:8},()=>randomUUID()),round=randomUUID(),teamA=randomUUID(),teamB=randomUUID(),otherRound=randomUUID(),otherTeam=randomUUID();
const names=['Igor','Jack','PH','Lobo','Outro 1','Outro 2','Outro 3','Outro 4'];
for(const [i,id] of [organizer,viewer,...ids].entries())await db.query('insert into auth.users values($1,$2,$3)',[id,'teste@example.invalid',JSON.stringify({name:i<2?'Conta de teste':names[i-2]})]);
await db.query("update public.profiles set role='organizador' where id=$1",[organizer]);
await db.query("insert into public.rachas(id,nome,data,estado) values($1,'Rodada teste','2026-10-08','aberto'),($2,'Outra rodada','2026-10-09','aberto')",[round,otherRound]);
for(let i=0;i<8;i++)await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,$3,'linha')",[round,ids[i],names[i]]);
await db.query("insert into public.times(id,racha_id,nome,numero,confirmado) values($1,$2,'Time 1',1,true),($3,$2,'Time 2',2,true),($4,$5,'Outro time',1,true)",[teamA,round,teamB,otherTeam,otherRound]);
for(let i=0;i<8;i++)await db.query('insert into public.time_jogadores(time_id,jogador_id,participante_id) select $1,$2,id from public.racha_participantes where jogador_id=$2 and racha_id=$3',[i<4?teamA:teamB,ids[i],round]);
await db.query("update public.rachas set estado='times_confirmados' where id in($1,$2)",[round,otherRound]);
async function user(id=organizer){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function newMatch(){return (await db.query('select public.criar_partida($1,$2,$3) as id',[round,teamA,teamB])).rows[0].id;}
async function read(id){const data=(await db.query('select public.ler_partidas_rodada($1) as result',[round])).rows[0].result;return data.partidas.find(m=>m.id===id);}
async function save(m,status='finalizada'){return (await db.query('select public.salvar_partida($1,$2,$3,$4,$5,$6) as result',[m.id,m.versao,m.placarA,m.placarB,status,JSON.stringify(m.jogadores)])).rows[0].result;}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
let passed=0;
async function check(name,fn){await db.exec('begin');try{await user();await fn();console.log('PASS '+name);passed++;}finally{await db.exec('rollback');}}

const finish=()=>db.query("select public.finalizar_rodada($1)",[round]);
const open=()=>db.query('select public.alterar_avaliacoes_rodada($1,true)',[round]);
await check('sem partida, aberta ou cancelada não permitem finalizar; abertura prematura bloqueada',async()=>{
 await invalid(finish,/Finalize pelo menos uma partida/);
 await invalid(open,/Finalize a rodada/);
 const m=await read(await newMatch());await invalid(finish,/Finalize pelo menos uma partida/);
 await save(m,'cancelada');await invalid(finish,/Finalize pelo menos uma partida/);
});
await check('jogador não pode finalizar nem abrir avaliações',async()=>{
 await save(await read(await newMatch()));await user(viewer);
 await invalid(finish,/Somente organizadores/);await invalid(open,/Somente organizadores/);
});
await check('finalização preserva times, partidas e lista; abertura é separada; ações bloqueadas no banco',async()=>{
 const m=await read(await newMatch());await save(m);
 const before=(await db.query('select id from public.times where racha_id=$1 order by id',[round])).rows;
 await finish();
 const r=(await db.query('select estado,updated_at,finalizada_at,avaliacoes_abertas from public.rachas where id=$1',[round])).rows[0];
 assert.equal(r.estado,'finalizado');assert.ok(r.updated_at);assert.ok(r.finalizada_at);assert.equal(r.avaliacoes_abertas,false);
 assert.equal((await read(m.id)).status,'finalizada');
 assert.deepEqual((await db.query('select id from public.times where racha_id=$1 order by id',[round])).rows,before);
 await invalid(finish,/finalizada não pode/);
 await invalid(()=>db.query("select public.alterar_estado_rodada($1,'aberto')",[round]),/finalizada não pode/);
 await invalid(()=>db.query("update public.racha_participantes set nome='Alterado' where racha_id=$1",[round]),/Reabra a lista/);
 await invalid(async()=>db.query('select public.salvar_rascunho_times($1,$2,$3)',[round,(await db.query('select versao from public.rachas where id=$1',[round])).rows[0].versao,'[]']),/finalizadas/);
 await invalid(newMatch,/times confirmados/);
 await user(ids[0]);assert.equal((await db.query('select public.pode_avaliar_companheiro($1,$3,$2) ok',[round,ids[1],ids[0]])).rows[0].ok,false);
 await user();await open();
 assert.equal((await db.query('select avaliacoes_abertas from public.rachas where id=$1',[round])).rows[0].avaliacoes_abertas,true);
 await open(); // abertura idempotente
 await user(ids[0]);assert.equal((await db.query('select public.pode_avaliar_companheiro($1,$3,$2) ok',[round,ids[1],ids[0]])).rows[0].ok,true);
});
await db.close();console.log(passed+' cenários PostgreSQL passaram.');
