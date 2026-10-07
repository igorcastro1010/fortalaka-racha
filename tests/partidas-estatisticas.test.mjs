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
for(const p of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql','supabase/partidas-estatisticas.sql','supabase/partidas-estatisticas.sql'])await db.exec(readFileSync(p,'utf8'));
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
async function stats(id){return (await db.query('select * from public.ler_estatisticas_jogadores($1)',[id])).rows[0];}
async function save(m,status='finalizada'){return (await db.query('select public.salvar_partida($1,$2,$3,$4,$5,$6) as result',[m.id,m.versao,m.placarA,m.placarB,status,JSON.stringify(m.jogadores)])).rows[0].result;}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
let passed=0;
async function check(name,fn){await db.exec('begin');try{await user();await fn();console.log('PASS '+name);passed++;}finally{await db.exec('rollback');}}
await check('3×2: Igor +1 jogo +2 gols +1 assistência +1 vitória; adversário sem vitória',async()=>{
 const id=await newMatch(),m=await read(id);assert.equal(m.jogadores.length,8);m.placarA=3;m.placarB=2;
 Object.assign(m.jogadores.find(p=>p.jogador_id===ids[0]),{gols:2,assistencias:1});
 m.jogadores.find(p=>p.jogador_id===ids[1]).gols=1;m.jogadores.find(p=>p.jogador_id===ids[2]).assistencias=1;
 const result=await save(m);assert.match(result.aviso,/placar difere/);
 const s=await stats(ids[0]);assert.deepEqual([s.jogos,s.gols,s.assistencias,s.vitorias],[1,2,1,1]);
 const opponent=await stats(ids[4]);assert.equal(opponent.jogos,1);assert.equal(opponent.vitorias,0);
});
await check('quatro partidas na mesma rodada contam quatro jogos sem multiplicar por eventos',async()=>{
 for(let i=0;i<4;i++){const m=await read(await newMatch());m.placarA=2;m.jogadores.find(p=>p.jogador_id===ids[0]).gols=2;m.jogadores.find(p=>p.jogador_id===ids[0]).assistencias=1;await save(m);}
 const s=await stats(ids[0]);assert.deepEqual([s.jogos,s.gols,s.assistencias,s.vitorias],[4,8,4,4]);
});
await check('abertas e canceladas não contam; empate e ausência não somam vitória',async()=>{
 for(const status of ['aberta','cancelada']){const m=await read(await newMatch());m.placarA=1;m.jogadores[0].gols=1;await save(m,status);}
 assert.equal((await stats(ids[0])).jogos,0);
 const m=await read(await newMatch());m.placarA=1;m.placarB=1;m.jogadores.find(p=>p.jogador_id===ids[3]).participou=false;await save(m);
 assert.equal((await stats(ids[0])).jogos,1);assert.equal((await stats(ids[0])).vitorias,0);assert.equal((await stats(ids[3])).jogos,0);
});
await check('corrigir finalizada recalcula gols, jogos e vitória; versão antiga é rejeitada',async()=>{
 const id=await newMatch();let m=await read(id);m.placarA=2;m.jogadores.find(p=>p.jogador_id===ids[0]).gols=2;await save(m);
 await invalid(()=>save(m),/outra sessão/);m=await read(id);m.placarA=0;m.placarB=1;m.jogadores.find(p=>p.jogador_id===ids[0]).gols=0;await save(m);
 const s=await stats(ids[0]);assert.deepEqual([s.jogos,s.gols,s.vitorias],[1,0,0]);
 m=await read(id);await save(m,'cancelada');assert.equal((await stats(ids[0])).jogos,0);
});
await check('RLS e RPC: jogador lê, mas não cria, salva nem altera eventos/placar',async()=>{
 const m=await read(await newMatch());await user(viewer);assert.equal((await read(m.id)).id,m.id);assert.equal((await stats(ids[0])).jogos,0);
 await invalid(()=>newMatch(),/Somente organizadores/);await invalid(()=>save(m),/Somente organizadores/);
 assert.equal((await db.query("update public.partidas set placar_a=99 returning id")).rows.length,0);
 await invalid(()=>db.query("insert into public.eventos_partida(partida_id,jogador_id,tipo) values($1,$2,'gol')",[m.id,ids[0]]),/row-level security/);
 assert.equal((await db.query('delete from public.partidas returning id')).rows.length,0);
});
await check('times da mesma rodada; composição, inteiros e eventos validados atomicamente',async()=>{
 await invalid(()=>db.query('select public.criar_partida($1,$2,$2)',[round,teamA]),/dois times|check constraint/);
 await invalid(()=>db.query('select public.criar_partida($1,$2,$3)',[round,teamA,otherTeam]),/mesma rodada/);
 const m=await read(await newMatch());await invalid(()=>save({...m,placarA:-1}),/inválido/);
 await invalid(()=>save({...m,jogadores:m.jogadores.slice(1)}),/todos os participantes/);
 const bad=structuredClone(m);bad.jogadores[0].participou=false;bad.jogadores[0].gols=1;await invalid(()=>save(bad),/não participou/);
 assert.equal((await read(m.id)).versao,0);assert.equal((await db.query('select count(*)::int n from public.eventos_partida')).rows[0].n,0);
 await invalid(()=>db.query("insert into public.eventos_partida(partida_id,jogador_id,tipo,quantidade) values($1,$2,'gol',0)",[m.id,ids[0]]),/check constraint/);
 await invalid(()=>db.query("insert into public.eventos_partida(partida_id,jogador_id,tipo) values($1,$2,'gol')",[m.id,viewer]),/participantes/);
 await db.exec('reset role');await invalid(()=>db.query('delete from public.times where id=$1',[teamA]),/foreign key constraint/);
});
await check('totais refletem participou=false e fotos/nome sem liberar e-mails',async()=>{
 const id=await newMatch();let m=await read(id);m.placarA=2;m.jogadores.find(p=>p.jogador_id===ids[0]).gols=2;await save(m);
 await db.query('update public.partida_jogadores set participou=false where partida_id=$1 and jogador_id=$2',[id,ids[0]]);
 const s=await stats(ids[0]);assert.deepEqual([s.jogos,s.gols,s.assistencias,s.vitorias],[0,0,0,0]);assert.equal('email' in s,false);
});
await db.close();console.log(`${passed} cenários PostgreSQL passaram.`);
