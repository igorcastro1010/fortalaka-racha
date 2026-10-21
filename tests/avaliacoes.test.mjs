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
for(const p of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql','supabase/partidas-estatisticas.sql','supabase/avaliacoes.sql','supabase/finalizar-rodada.sql','supabase/entrada-avaliacoes.sql','supabase/fluxo-principal.sql','supabase/fluxo-sem-posicoes.sql','supabase/avaliacoes-elegibilidade.sql'])await db.exec(readFileSync(p,'utf8'));

const organizer=randomUUID(), ids=Array.from({length:8},()=>randomUUID()), round=randomUUID(), teamA=randomUUID(), teamB=randomUUID();
const names=['Igor','Jack','PH','Lobo','Dede','Levi','Bruno','Arthur'];
for(const [i,id] of [organizer,...ids].entries())await db.query('insert into auth.users values($1,$2,$3)',[id,`u${i}@example.invalid`,JSON.stringify({name:i?'Conta':'Organizador'})]);
for(let i=0;i<ids.length;i++)await db.query('update public.profiles set name=$2 where id=$1',[ids[i],names[i]]);
await db.query("update public.profiles set role='organizador' where id=$1",[organizer]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[organizer]);
await db.query("insert into public.rachas(id,nome,data,estado) values($1,'Rodada avaliacao','2026-10-09','aberto')",[round]);
for(let i=0;i<8;i++)await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,$3,'linha','confirmado')",[round,ids[i],names[i]]);
await db.query("insert into public.times(id,racha_id,nome,numero,confirmado) values($1,$2,'Time 1',1,true),($3,$2,'Time 2',2,true)",[teamA,round,teamB]);
for(let i=0;i<8;i++)await db.query('insert into public.time_jogadores(time_id,jogador_id,participante_id) select $1,$2,id from public.racha_participantes where jogador_id=$2 and racha_id=$3',[i<4?teamA:teamB,ids[i],round]);
await db.query("update public.rachas set estado='times_confirmados' where id=$1",[round]);

async function user(id){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
async function readEval(){return (await db.query('select public.ler_avaliacoes_atual($1) as result',[round])).rows[0].result;}
async function save(target,scores=[4,5,4,3,4],roundId=round){
  return db.query('select public.salvar_avaliacao($1,$2,$3,$4,$5,$6,$7)',[roundId,target,...scores]);
}

await user(organizer);
await db.exec('begin');
await invalid(()=>db.query('select public.alterar_avaliacoes_rodada($1,true)',[round]),/Finalize a rodada/);
const matchId=(await db.query('select public.criar_partida($1,$2,$3) as id',[round,teamA,teamB])).rows[0].id;
let match=(await db.query('select public.ler_partidas_rodada($1) as result',[round])).rows[0].result.partidas[0];
match.placarA=3;match.placarB=2;
await db.query('select public.salvar_partida($1,$2,$3,$4,$5,$6)',[matchId,match.versao,match.placarA,match.placarB,'finalizada',JSON.stringify(match.jogadores)]);
await invalid(()=>db.query('select public.alterar_avaliacoes_rodada($1,true)',[round]),/Finalize a rodada/);
await user(ids[0]);await invalid(()=>save(ids[1]),/abertas|companheiros|avaliacoes/i);
await user(organizer);

await db.query('select public.finalizar_rodada($1)',[round]);
await user(ids[0]);
await invalid(()=>save(ids[1]),/abertas|companheiros|avaliacoes/i);

await user(organizer);
let progress=(await db.query('select public.alterar_avaliacoes_rodada($1,true) as result',[round])).rows[0].result;
assert.deepEqual([progress.total,progress.respondentes,progress.abertas],[8,0,true]);
assert.equal((await db.query('select estado from public.rachas where id=$1',[round])).rows[0].estado,'finalizado');
assert.equal((await db.query('select count(*)::int n from public.avaliacoes')).rows[0].n,0,'Abrir não cria avaliações antecipadas');

await user(ids[0]);
let state=await readEval();
assert.equal(state.canEvaluate,true);
assert.equal(state.roundId,round);
await invalid(()=>db.query('select public.alterar_avaliacoes_rodada($1,false)',[round]),/Somente organizadores/);
for(let index=0;index<5;index++)for(const value of [0,6,null]){
  const scores=[3,3,3,3,3];scores[index]=value;
  await invalid(()=>save(ids[1],scores),/check constraint|not-null constraint/);
}
assert.deepEqual(state.players.map(p=>p.nome),['Jack','Lobo','PH']);
await invalid(()=>save(ids[0]),/companheiros|auto|avaliar/i);
await invalid(()=>save(ids[4]),/companheiros|time/i);
await invalid(()=>save(organizer),/companheiros|time/i);
assert.equal((await db.query('select public.pode_avaliar_companheiro($1,$2,$3) as allowed',[round,ids[0],organizer])).rows[0].allowed,false,'Perfil sem participação retorna false, não NULL');
await invalid(()=>db.query('insert into public.avaliacoes(racha_id,avaliador_id,avaliado_id,time_id,passe,chute,velocidade,defesa,fisico) values($1,$2,$3,$4,3,3,3,3,3)',[round,ids[2],ids[1],teamA]),/proprio|próprio|row-level security/);
await save(ids[1]);
const original=(await db.query('select id,created_at from public.avaliacoes where racha_id=$1 and avaliado_id=$2',[round,ids[1]])).rows[0];
await save(ids[1],[5,5,5,5,5]);
assert.deepEqual((await db.query('select id,created_at from public.avaliacoes where racha_id=$1 and avaliado_id=$2',[round,ids[1]])).rows[0],original,'Editar mantém o mesmo registro');
assert.equal((await db.query('select count(*)::int n from public.avaliacoes where avaliador_id=$1 and avaliado_id=$2',[ids[0],ids[1]])).rows[0].n,1);
state=await readEval();
assert.equal(state.players.find(p=>p.jogador_id===ids[1]).avaliado,true);
assert.equal(state.players.find(p=>p.jogador_id===ids[1]).passe,5);

await user(organizer);
let summary=(await db.query('select * from public.medias_jogador($1)',[ids[1]])).rows[0];
assert.equal(summary.quantidade,1);
assert.equal(summary.passe,null);

await user(ids[2]);
await save(ids[1],[5,4,4,4,5]);
await user(organizer);
summary=(await db.query('select * from public.medias_jogador($1)',[ids[1]])).rows[0];
assert.deepEqual([summary.quantidade,Number(summary.passe),Number(summary.chute),Number(summary.velocidade),Number(summary.defesa),Number(summary.fisico)],[2,10,9,9,9,10]);
const ranking=(await db.query('select * from public.ler_estatisticas_jogadores($1)',[ids[1]])).rows[0];
assert.equal(ranking.nota_geral_100,94);
await user(ids[1]);
assert.equal((await db.query('select count(*)::int n from public.avaliacoes')).rows[0].n,0,'Recebedor não lê autores ou notas individuais de outros');
await user(organizer);
assert.equal((await db.query('select count(*)::int n from public.avaliacoes')).rows[0].n,0,'Organizador não recebe acesso às notas individuais');
progress=(await db.query('select public.ler_progresso_avaliacoes($1) as result',[round])).rows[0].result;
assert.deepEqual([progress.total,progress.respondentes,progress.abertas],[8,2,true]);

await db.query('select public.alterar_avaliacoes_rodada($1,false)',[round]);
assert.deepEqual((await db.query('select * from public.medias_jogador($1)',[ids[1]])).rows[0],summary,'Fechar preserva médias');
await invalid(()=>save(ids[1]),/companheiros|abertas/);
await user(ids[0]);
await invalid(()=>save(ids[2]),/fechadas|abertas/i);

state=await readEval();
assert.equal(state.open,false);
assert.equal(state.canEvaluate,false);
assert.equal(state.players.find(p=>p.jogador_id===ids[1]).avaliado,true);
await invalid(()=>save(ids[1],[3,3,3,3,3]),/fechadas|abertas/i);
await invalid(()=>db.query('update public.avaliacoes set passe=1 where racha_id=$1',[round]),/fechadas|invalido|inválido/i);

// Uma rodada antiga aberta não deve substituir a rodada escolhida pelo jogador.
await user(organizer);
await db.query('select public.alterar_avaliacoes_rodada($1,true)',[round]);
await db.exec('reset role');
const newRound=randomUUID();
await db.query("insert into public.rachas(id,nome,data,estado) values($1,'Rodada atual','2026-10-16','aberto')",[newRound]);
await user(ids[0]);
const current=(await db.query('select public.ler_avaliacoes_atual(null) as result')).rows[0].result;
assert.equal(current.roundId,newRound);assert.equal(current.open,false);assert.deepEqual(current.players,[]);
assert.equal((await readEval()).roundId,round);
assert.equal((await db.query('select public.ler_avaliacoes_atual($1) as result',[randomUUID()])).rows[0].result,null);

// O mínimo e as médias atuais são históricos, não reiniciam a cada rodada.
await user(ids[0]);await save(ids[2],[4,4,4,4,4]);
await user(ids[1]);await save(ids[2],[4,4,4,4,4]);
await user(organizer);
for(let i=0;i<8;i++)await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,$3,'linha','confirmado')",[newRound,ids[i],names[i]]);
const registrations=(await db.query('select id,jogador_id from public.racha_participantes where racha_id=$1',[newRound])).rows;
const payload=[0,1].map(i=>({numero:i+1,nome:`Time ${i+1}`,jogadores:ids.slice(i*4,i*4+4).map(id=>registrations.find(p=>p.jogador_id===id).id)}));
const version=async()=>(await db.query('select versao from public.rachas where id=$1',[newRound])).rows[0].versao;
await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[newRound]);
await db.query('select public.salvar_rascunho_times($1,$2,$3)',[newRound,await version(),JSON.stringify(payload)]);
await db.query('select public.confirmar_rascunho_times($1,$2)',[newRound,await version()]);
const newTeams=(await db.query('select public.ler_times_rodada() as result')).rows[0].result.teams;
const [newTeamA,newTeamB]=newTeams.map(t=>t.id);
const newMatchId=(await db.query('select public.criar_partida($1,$2,$3) as id',[newRound,newTeamA,newTeamB])).rows[0].id;
const newMatch=(await db.query('select public.ler_partidas_rodada($1) as result',[newRound])).rows[0].result.partidas[0];
await db.query('select public.salvar_partida($1,$2,0,0,$3,$4)',[newMatchId,newMatch.versao,'finalizada',JSON.stringify(newMatch.jogadores)]);
await db.query('select public.finalizar_rodada($1)',[newRound]);
await db.query('select public.alterar_avaliacoes_rodada($1,true)',[newRound]);
await user(ids[0]);await save(ids[1],[1,1,1,1,1],newRound);await save(ids[2],[5,5,5,5,5],newRound);
await user(ids[1]);await save(ids[2],[4,4,4,4,4],newRound);
await user(organizer);
const historical=(await db.query('select * from public.medias_jogador($1)',[ids[1]])).rows[0];
assert.equal(historical.quantidade,3);
assert(Math.abs(Number(historical.passe)-22/3)<1e-9);
assert.equal((await db.query('select * from public.ler_estatisticas_jogadores($1)',[ids[1]])).rows[0].nota_geral_100,69);
const example=(await db.query('select * from public.ler_estatisticas_jogadores($1)',[ids[2]])).rows[0];
assert.equal(example.quantidade_avaliacoes,4);assert.equal(example.nota_geral_100,85,'Média 4,25 resulta em 85/100');

// Reaplicar a correção deve manter todas as notas e autorias existentes.
await db.exec('reset role');
const stored=(await db.query('select * from public.avaliacoes order by id')).rows;
await db.exec(readFileSync('supabase/avaliacoes-elegibilidade.sql','utf8'));
await db.exec(readFileSync('supabase/avaliacoes-elegibilidade.sql','utf8'));
assert.deepEqual((await db.query('select * from public.avaliacoes order by id')).rows,stored);
assert.equal(stored.filter(a=>a.racha_id===round).length,4,'Avaliações antigas preservadas');
await db.exec('commit');
await db.close();
console.log('PASS avaliações: finalização obrigatória; 15 notas inválidas; elegibilidade; autoria; edição/unicidade; fechamento; privacidade; médias históricas; 4,25 → 85; migração idempotente');
