// Hub real, relógio e transporte controlados; nenhuma conexão externa.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const {build}=createRequire(resolve(process.argv[2],'package.json'))('esbuild');
const result=await build({entryPoints:['src/lib/live/refresh.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'isolated-client',setup(b){b.onResolve({filter:/lib\/supabase\/client/},()=>({path:'client',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export function createClient(){return globalThis.client}',loader:'js'}));}}]});
let now=0,next=0,channels=0,removed=0;const timers=new Map(),events=[];
const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';const navigator={onLine:true};
const channel={on(type,filter,handler){events.push({filter,handler});return this},subscribe(handler){this.status=handler;return this}};
const client={channel(){channels++;return channel},async removeChannel(){removed++}};
const context={module:{exports:{}},exports:{},client,window,document,navigator,console,Promise,AbortController,DOMException,
 setTimeout(fn,delay){const id=++next;timers.set(id,{fn,at:now+delay});return id},clearTimeout(id){timers.delete(id)}};
context.exports=context.module.exports;vm.runInNewContext(result.outputFiles[0].text,context);
const {subscribeLiveRefresh}=context.module.exports;
async function tick(ms){const end=now+ms;for(;;){const item=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;const[id,t]=item;now=t.at;timers.delete(id);t.fn();await new Promise(r=>setImmediate(r));}now=end;await new Promise(r=>setImmediate(r));}
let rounds=0,matches=0,notifications=0;
const a=subscribeLiveRefresh(()=>{rounds++},['round']);const b=subscribeLiveRefresh(()=>{matches++},['matches']);const n=subscribeLiveRefresh(()=>{notifications++},['notifications']);
assert.equal(channels,1);assert.equal(events.length,8);
channel.status('SUBSCRIBED');await tick(300);rounds=matches=notifications=0;
await tick(60000);assert.equal(rounds,0,'Canal saudável: zero polling operacional por minuto');assert.equal(matches,0);assert.equal(notifications,2,'Tabela sem publicação: reconciliação de 30 s');
for(let i=0;i<20;i++)events.find(e=>e.filter.table==='eventos_partida').handler();
await tick(300);assert.equal(matches,1);assert.equal(rounds,0,'Gol não relê lista/avatares');
let finish,reads=0;const off=subscribeLiveRefresh(()=>{reads++;if(reads===1)return new Promise(r=>{finish=r})},['matches']);
events.find(e=>e.filter.table==='partidas').handler();await tick(300);events.find(e=>e.filter.table==='partidas').handler();await tick(300);assert.equal(reads,1);
finish();await tick(0);await tick(300);assert.equal(reads,2,'Evento durante leitura exige nova consulta');off();
document.visibilityState='hidden';const count=matches;events[0].handler();await tick(60000);assert.equal(matches,count);
document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));await tick(300);assert(matches>count);
channel.status('CHANNEL_ERROR');rounds=0;await tick(5000);channel.status('TIMED_OUT');await tick(5000);await tick(300);assert.equal(rounds,1,'Erros repetidos não adiam fallback');await tick(10000);assert.equal(rounds,1,'Fallback aplica backoff');await tick(10300);assert.equal(rounds,2);
channel.status('SUBSCRIBED');await tick(300);rounds=0;await tick(60000);assert.equal(rounds,0,'Reconexão desliga fallback');
let failures=0;const retry=subscribeLiveRefresh(()=>{if(++failures===1)throw Error('rede temporária')},['matches']);await tick(300);await tick(1300);assert.equal(failures,2,'Falha transitória não perde invalidação');retry();
let resumed=0;const pause=subscribeLiveRefresh(()=>{resumed++},['teams']);await tick(300);pause();const resume=subscribeLiveRefresh(()=>{resumed++},['teams']);await tick(300);assert.equal(resumed,2,'Retomada após edição revalida');resume();
navigator.onLine=false;window.dispatchEvent(new Event('offline'));const before=notifications;await tick(60000);assert.equal(notifications,before);
a();b();n();assert.equal(removed,1);assert.equal(timers.size,0);
console.log('PASS hub: 12→0 ciclos operacionais/min saudável; reconciliação 2/min, invalidação específica, backoff, replay, offline e cleanup');
