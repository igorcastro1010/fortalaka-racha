// Fluxo e segurança novos em PostgreSQL isolado. Nenhum acesso remoto.
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
for(const p of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql','supabase/partidas-estatisticas.sql','supabase/avaliacoes.sql','supabase/finalizar-rodada.sql','supabase/entrada-avaliacoes.sql','supabase/fluxo-principal.sql','supabase/fluxo-sem-posicoes.sql','supabase/fluxo-sem-posicoes.sql'])await db.exec(readFileSync(p,'utf8'));

const organizers=Array.from({length:5},()=>randomUUID());
const players=Array.from({length:25},()=>randomUUID());
const keepers=Array.from({length:5},()=>randomUUID());
for(const [i,id] of [...organizers,...players,...keepers].entries())await db.query('insert into auth.users values($1,$2,$3)',[id,'teste@example.invalid',JSON.stringify({name:`Pessoa ${i}`})]);
await db.query("update public.profiles set role='organizador' where id=any($1::uuid[])",[organizers]);
async function user(id=organizers[0]){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
async function row(sql,args=[]){return (await db.query(sql,args)).rows[0];}
const scalar=async(sql,args=[])=>Object.values(await row(sql,args))[0];
let checks=0;
async function check(name,fn){await db.exec('begin');try{await user();await fn();await db.exec('commit');console.log('PASS '+name);checks++;}catch(e){await db.exec('rollback');throw e;}}
let round;
let payload;
let teams;
const roundVersion=()=>scalar('select versao from public.rachas where id=$1',[round]);
const read=()=>scalar('select public.ler_partidas_rodada($1)',[round]);
const next=async()=>scalar('select public.criar_proxima_partida($1,$2)',[round,(await read()).fila.version]);
async function finish(id,a,b,skip=null){const m=(await read()).partidas.find(m=>m.id===id);for(const player of m.jogadores){player.gols=0;player.assistencias=0;if(player.jogador_id===skip)player.participou=false;}return scalar('select public.salvar_partida($1,$2,$3,$4,$5,$6)',[m.id,m.versao,a,b,'finalizada',JSON.stringify(m.jogadores)]);}

await check('criação somente por organizador; lista vazia pode fechar e reabrir',async()=>{
 await user(players[0]);
 await invalid(()=>db.query("insert into public.rachas(nome,data,horario,endereco) values('Negado','2026-10-15','20:00','Quadra')"),/row-level security/);
 await user();
 await invalid(()=>db.query("insert into public.rachas(nome,estado) values('Atalho','finalizado')"),/rodada aberta/);
 round=await scalar("insert into public.rachas(nome,data,horario,endereco) values('Fluxo','2026-10-15','20:00','Quadra') returning id");
 await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[round]);
 assert.equal(await scalar('select estado from public.rachas where id=$1',[round]),'lista_fechada');
 await db.query("select public.alterar_estado_rodada($1,'aberto')",[round]);
});
await check('inscrição própria, sair/reentrar sem apagar dados nem duplicar; RLS protege terceiros',async()=>{
 await user(players[0]);await db.query("select public.inscricao_rodada($1,'linha',true)",[round]);
 const original=await scalar('select id from public.racha_participantes where racha_id=$1 and jogador_id=$2',[round,players[0]]);
 await db.query("select public.inscricao_rodada($1,null,false)",[round]);
 assert.equal(await scalar('select status from public.racha_participantes where id=$1',[original]),'removido');
 await db.query("select public.inscricao_rodada($1,'linha',true)",[round]);
 await db.query("select public.inscricao_rodada($1,'linha',true)",[round]);
 assert.equal(await scalar('select id from public.racha_participantes where racha_id=$1 and jogador_id=$2',[round,players[0]]),original);
 await invalid(()=>db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,'Outro','linha')",[round,players[1]]),/própria inscrição|row-level security/);
 await db.query("select public.inscricao_rodada($1,null,true)",[round]);
 assert.equal(await scalar('select tipo from public.racha_participantes where id=$1',[original]),'linha');
 for(const id of players.slice(1,20)){await user(id);await db.query("select public.inscricao_rodada($1,'linha',true)",[round]);}
 await user();
 for(const id of keepers.slice(0,4))await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,'Legado','goleiro','ausente')",[round,id]);
 await db.query("update public.racha_participantes set tipo='goleiro' where racha_id=$1 and jogador_id=$2",[round,players[2]]);
 await user(players[0]);assert.equal((await db.query("update public.racha_participantes set status='removido' where jogador_id=$1 returning id",[players[1]])).rows.length,0);
 assert.equal((await db.query('delete from public.racha_participantes where jogador_id=$1 returning id',[players[1]])).rows.length,0);
});
await check('lista fechada bloqueia inscrição/saída; os cinco organizadores podem ajustar',async()=>{
 await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[round]);
 await user(players[0]);await invalid(()=>db.query('select public.inscricao_rodada($1,null,false)',[round]),/lista está fechada/);
 assert.equal((await db.query("update public.racha_participantes set status='removido' where jogador_id=$1 returning id",[players[0]])).rows.length,0);
 await invalid(()=>db.query("select public.inscricao_rodada($1,'linha',true)",[round]),/lista está fechada/);
 for(const admin of organizers){await user(admin);assert.equal((await db.query("update public.racha_participantes set status='confirmado' where jogador_id=$1 and racha_id=$2 returning id",[players[0],round])).rows.length,1);}
});
await check('20 participantes, incluindo tipo legado, sem posições; ajuste persiste e confirmação reutiliza IDs',async()=>{
 const participants=(await db.query('select * from public.racha_participantes where racha_id=$1 order by nome',[round])).rows;
 const lines=participants.filter(p=>p.status==='confirmado' && p.tipo!=='suplente');
 assert.equal(lines.length,20);assert(lines.some(p=>p.tipo==='goleiro'));
 payload=Array.from({length:4},(_,i)=>({numero:i+1,nome:`Time ${i+1}`,jogadores:lines.slice(i*5,i*5+5).map(p=>p.id)}));
 await db.query('select public.salvar_rascunho_times($1,$2,$3)',[round,await roundVersion(),JSON.stringify(payload)]);
 const before=(await db.query('select id from public.times where racha_id=$1 order by numero',[round])).rows;
 [payload[0].jogadores[0],payload[1].jogadores[0]]=[payload[1].jogadores[0],payload[0].jogadores[0]];
 await db.query('select public.salvar_rascunho_times($1,$2,$3)',[round,await roundVersion(),JSON.stringify(payload)]);
 assert.deepEqual((await db.query('select id from public.times where racha_id=$1 order by numero',[round])).rows,before);
 const state=await scalar('select public.ler_times_rodada()');
 assert.equal(state.teams.length,4);assert(state.teams.every(t=>t.players.length===5 && !('goalkeeper' in t)));
 await user(players[0]);assert.equal((await scalar('select public.ler_times_rodada()')).teams.length,0);
 await user();await db.query('select public.confirmar_rascunho_times($1,$2)',[round,await roundVersion()]);
 teams=(await read()).fila.order;
 assert.equal(teams.length,4);
 await user(players[0]);assert.equal((await scalar('select public.ler_times_rodada()')).teams.length,4);
 await invalid(next,/Somente organizadores/);
 await invalid(()=>db.query('update public.fila_times set ordem=$1 where racha_id=$2',[teams.slice().reverse(),round]),/permission denied/);
});
await check('primeira partida inclui participantes comuns e legados; vencedor fica, perdedor vai ao fim',async()=>{
 const oldVersion=(await read()).fila.version;
 const id=await next();const m=(await read()).partidas.find(p=>p.id===id);
 assert.equal(m.timeAId,teams[0]);assert.equal(m.timeBId,teams[1]);assert.equal(m.jogadores.length,10);
 assert.equal(await scalar('select estado from public.rachas where id=$1',[round]),'em_andamento');
 await invalid(next,/partida atual/);
 await invalid(()=>db.query('select public.criar_proxima_partida($1,$2)',[round,oldVersion]),/fila foi alterada/);
 await invalid(async()=>db.query('select public.salvar_rascunho_times($1,$2,$3)',[round,await roundVersion(),JSON.stringify(payload)]),/após iniciar/);
 await finish(id,2,0,m.jogadores[0].jogador_id);
 assert.deepEqual((await read()).fila.order,[teams[0],teams[2],teams[3],teams[1]]);
 const stats=await row('select * from public.ler_estatisticas_jogadores($1)',[m.jogadores[0].jogador_id]);assert.equal(Number(stats.jogos),0);
});
await check('empate tira os dois; nova partida segue a fila; correção recalcula sem duplicatas',async()=>{
 const id=await next();await finish(id,1,1);
 assert.deepEqual((await read()).fila.order,[teams[3],teams[1],teams[0],teams[2]]);
 const nextId=await next();const m=(await read()).partidas.find(p=>p.id===nextId);
 assert.equal(m.timeAId,teams[3]);assert.equal(m.timeBId,teams[1]);await finish(nextId,0,2);
 assert.deepEqual((await read()).fila.order,[teams[1],teams[0],teams[2],teams[3]]);
 await finish(id,2,1);const queue=(await read()).fila.order;assert.equal(new Set(queue).size,4);assert.deepEqual(new Set(queue),new Set(teams));
});
await check('encerrar preserva fila e histórico; novas partidas/sorteios bloqueados; abrir separado',async()=>{
 const before=await read();await db.query('select public.finalizar_rodada($1)',[round]);
 const r=await row('select estado,finalizada_at,avaliacoes_abertas from public.rachas where id=$1',[round]);
 assert.equal(r.estado,'finalizado');assert(r.finalizada_at);assert.equal(r.avaliacoes_abertas,false);
 assert.deepEqual((await read()).fila.order,before.fila.order);assert.equal((await read()).partidas.length,before.partidas.length);
 await invalid(next,/finalizado/);
 await invalid(()=>db.query('select public.criar_partida($1,$2,$3)',[round,teams[0],teams[1]]),/times confirmados/);
 await invalid(async()=>db.query('select public.salvar_rascunho_times($1,$2,$3)',[round,await roundVersion(),JSON.stringify(payload)]),/após iniciar/);
 await invalid(()=>db.query("update public.racha_participantes set status='removido' where racha_id=$1",[round]),/lista está preservada/);
 await db.query('select public.alterar_avaliacoes_rodada($1,true)',[round]);
 const m=before.partidas[1],a=m.jogadores.find(p=>p.time_id===m.timeAId),b=m.jogadores.find(p=>p.time_id===a.time_id && p.jogador_id!==a.jogador_id),enemy=m.jogadores.find(p=>p.time_id!==a.time_id);
 await user(a.jogador_id);
 const evaluation=await scalar('select public.ler_avaliacoes_atual($1)',[round]);
 assert(!evaluation.players.some(p=>p.jogador_id===a.jogador_id || p.jogador_id===enemy.jogador_id));
 await db.query('select public.salvar_avaliacao($1,$2,5::smallint,5::smallint,5::smallint,5::smallint,5::smallint)',[round,b.jogador_id]);
 await db.query('select public.salvar_avaliacao($1,$2,4::smallint,4::smallint,4::smallint,4::smallint,4::smallint)',[round,b.jogador_id]);
 assert.equal((await scalar('select public.ler_avaliacoes_atual($1)',[round])).players.filter(p=>p.avaliado).length,1);
 const c=m.jogadores.find(p=>p.time_id===a.time_id && ![a.jogador_id,b.jogador_id].includes(p.jogador_id));
 await user(c.jogador_id);await db.query('select public.salvar_avaliacao($1,$2,5::smallint,5::smallint,5::smallint,5::smallint,5::smallint)',[round,b.jogador_id]);
 const stats=await row('select * from public.ler_estatisticas_jogadores($1)',[b.jogador_id]);assert.equal(stats.nota_geral_100,90);
 await user(b.jogador_id);const summary=await row('select * from public.medias_jogador($1)',[b.jogador_id]);assert.equal(Number(summary.passe),9);
 for(const key of ['passe','chute','velocidade','defesa','fisico'])assert.equal(Number(summary[key]),9);
 assert.equal(Number(await scalar('select count(*) from public.avaliacoes')),0,'Recebedor não vê autoria das notas de outros');
 await invalid(()=>db.query('select public.salvar_avaliacao($1,$2,5::smallint,5::smallint,5::smallint,5::smallint,5::smallint)',[round,b.jogador_id]),/companheir|próprio|avaliar/i);
 await invalid(()=>db.query('select public.salvar_avaliacao($1,$2,5::smallint,5::smallint,5::smallint,5::smallint,5::smallint)',[round,enemy.jogador_id]),/companheir|avaliar/i);
 await invalid(()=>db.query('select public.alterar_avaliacoes_rodada($1,false)',[round]),/organizador/i);
 await user();await db.query('select public.alterar_avaliacoes_rodada($1,false)',[round]);
 await user(c.jogador_id);await invalid(()=>db.query('select public.salvar_avaliacao($1,$2,5::smallint,5::smallint,5::smallint,5::smallint,5::smallint)',[round,b.jogador_id]),/fechad|avaliar/i);
 await user(b.jogador_id);assert.equal(Number((await row('select * from public.medias_jogador($1)',[b.jogador_id])).passe),9);

});
await check('sorteio de 5, 10, 13, 15, 18, 20 e 23 participantes e fila dinâmica; sem posições ou validações de goleiros',async()=>{
 for(const count of [5,10,13,15,18,20,23]){
   await user();const rid=await scalar("insert into public.rachas(nome,data) values('Dinâmico','2026-10-22') returning id");
   for(const id of players.slice(0,count)){await user(id);await db.query("select public.inscricao_rodada($1,'linha',true)",[rid]);}
   await user();await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[rid]);
   const ids=(await db.query('select id from public.racha_participantes where racha_id=$1 order by id',[rid])).rows.map(p=>p.id);
   const k=Math.ceil(count/5),base=Math.floor(count/k);let index=0;
   const data=Array.from({length:k},(_,i)=>({numero:i+1,nome:`Time ${i+1}`,jogadores:ids.slice(index,index+=base+(i<count%k?1:0)),goleiro:null}));
   await db.query('select public.salvar_rascunho_times($1,$2,$3)',[rid,await scalar('select versao from public.rachas where id=$1',[rid]),JSON.stringify(data)]);
   await db.query('select public.confirmar_rascunho_times($1,$2)',[rid,await scalar('select versao from public.rachas where id=$1',[rid])]);
   const before=await scalar('select public.ler_partidas_rodada($1)',[rid]);
   if(k===1){await invalid(()=>db.query('select public.criar_proxima_partida($1,$2)',[rid,before.fila.version]),/dois times/);continue;}
   const pid=await scalar('select public.criar_proxima_partida($1,$2)',[rid,before.fila.version]);
   const match=(await scalar('select public.ler_partidas_rodada($1)',[rid])).partidas.find(m=>m.id===pid);
   await db.query('select public.salvar_partida($1,$2,0,0,$3,$4)',[pid,match.versao,'finalizada',JSON.stringify(match.jogadores)]);
   assert.deepEqual((await scalar('select public.ler_partidas_rodada($1)',[rid])).fila.order,[...before.fila.order.slice(2),...before.fila.order.slice(0,2)]);
 }
});
// Simula upgrade real: roda a versão anterior, cria uma rodada com goleiros já jogada e migra.
await db.exec('reset role');await db.exec(readFileSync('supabase/fluxo-principal.sql','utf8'));
await user();
const legacy=await scalar("insert into public.rachas(nome,data) values('Histórico legado','2050-01-01') returning id");
for(const [i,id] of [...players.slice(0,10),...keepers.slice(0,2)].entries())await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,'Legado',$3)",[legacy,id,i<10?'linha':'goleiro']);
await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[legacy]);
const oldParts=(await db.query('select * from public.racha_participantes where racha_id=$1 order by jogador_id',[legacy])).rows;
const oldLines=oldParts.filter(p=>p.tipo==='linha'),oldKeepers=oldParts.filter(p=>p.tipo==='goleiro');
const oldTeams=[0,1].map(i=>({numero:i+1,nome:`Time ${i+1}`,jogadores:oldLines.slice(i*5,i*5+5).map(p=>p.id),goleiro:oldKeepers[i].id}));
const v=async()=>scalar('select versao from public.rachas where id=$1',[legacy]);
await db.query('select public.salvar_rascunho_times($1,$2,$3)',[legacy,await v(),JSON.stringify(oldTeams)]);
await db.query('select public.confirmar_rascunho_times($1,$2)',[legacy,await v()]);
const oldQueue=(await scalar('select public.ler_partidas_rodada($1)',[legacy])).fila;
const oldMatch=await scalar('select public.criar_proxima_partida($1,$2)',[legacy,oldQueue.version]);
const oldState=await scalar('select public.ler_partidas_rodada($1)',[legacy]);const om=oldState.partidas[0];
await db.query('select public.salvar_partida($1,$2,2,0,$3,$4)',[oldMatch,om.versao,'finalizada',JSON.stringify(om.jogadores)]);
await db.query('select public.finalizar_rodada($1)',[legacy]);
await db.exec('reset role');
const snapshot=async()=>({
  rounds:(await db.query('select id,estado,finalizada_at,avaliacoes_abertas from public.rachas order by id')).rows,
  queues:(await db.query('select * from public.fila_times order by racha_id')).rows,
  matches:(await db.query('select * from public.partidas order by id')).rows,
  registrations:(await db.query('select * from public.racha_participantes order by id')).rows,
  teams:(await db.query('select * from public.time_jogadores order by id')).rows,
  evaluations:(await db.query('select * from public.avaliacoes order by id')).rows,
});
const saved=await snapshot();await db.exec(readFileSync('supabase/fluxo-sem-posicoes.sql','utf8'));
assert.deepEqual(await snapshot(),saved);
const legacyRead=await scalar('select public.ler_times_rodada()');assert.equal(legacyRead.roundId,legacy);assert(legacyRead.teams.every(t=>t.players.length===6 && !('goalkeeper' in t)));
checks++;console.log('PASS reaplicar migração preserva rodadas, filas, partidas, lista, times e avaliações existentes');
await db.close();console.log(checks+' cenários novos passaram.');
