import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
const {build}=createRequire(resolve(process.argv[2],'package.json'))('esbuild');
const bundle=await build({stdin:{contents:"export * from './src/lib/live/transport';export * from './src/lib/live/cache';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'client',setup(b){b.onResolve({filter:/lib\/supabase\/client/},()=>({path:'fake',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export function createClient(){return {}}'}));}}]});
let calls=0,fail=false;
const c={module:{exports:{}},exports:{},window:{},URL,AbortController,DOMException,Date,Promise,fetch:async()=>{calls++;if(fail)throw Error('rede');return {value:calls}}};c.exports=c.module.exports;vm.runInNewContext(bundle.outputFiles[0].text,c);
const {performanceFetch,mutationDomains,readMemory,setMemorySession}=c.module.exports;
setMemorySession('user');const rpc='https://fixture.invalid/rest/v1/rpc/';
for(const name of ['ler_partidas_rodada','ler_estatisticas_jogadores','avatars_da_rodada','medias_jogador'])assert.equal(mutationDomains(rpc+name,'POST').length,0);
for(const name of ['atualizar_pagamento','inscricao_rodada','salvar_rascunho_times','salvar_partida_com_desempate']){
  assert(mutationDomains(rpc+name,'POST').length);
  const first=await performanceFetch(rpc+name,{method:'POST'});const second=await performanceFetch(rpc+name,{method:'POST'});assert.notEqual(first.value,second.value,'Operação crítica sempre chega ao transporte');
}
let loads=0;await readMemory('round',['round'],async()=>++loads);
await performanceFetch(rpc+'inscricao_rodada',{method:'POST'});await readMemory('round',['round'],async()=>++loads);assert.equal(loads,2);
fail=true;await assert.rejects(performanceFetch(rpc+'inscricao_rodada',{method:'POST'}));await readMemory('round',['round'],async()=>++loads);assert.equal(loads,3,'Falha ambígua também invalida');
console.log('PASS operações críticas sem replay/cache de transporte; invalidação em sucesso e falha de rede');
