// Hub real com relógio e transporte isolados: sem conexão externa.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const {build}=createRequire(resolve(process.argv[2],'package.json'))('esbuild');
const result=await build({entryPoints:['src/lib/live/refresh.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'isolated-client',setup(b){b.onResolve({filter:/lib\/supabase\/client/},()=>({path:'client',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export function createClient(){return globalThis.client}',loader:'js'}));}}]});
let now=0,next=0,channels=0,removed=0;const timers=new Map(),events=[];
const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
const navigator={onLine:true};
const channel={on(type,filter,handler){assert.equal(type,'postgres_changes');events.push({filter,handler});return this},subscribe(handler){this.status=handler;return this}};
const client={channel(){channels++;return channel},async removeChannel(){removed++}};
const context={module:{exports:{}},exports:{},client,window,document,navigator,console,Promise,
 setTimeout(fn,delay){const id=++next;timers.set(id,{fn,at:now+delay});return id},clearTimeout(id){timers.delete(id)},
 setInterval(fn,delay){const id=++next;timers.set(id,{fn,at:now+delay,delay});return id},clearInterval(id){timers.delete(id)}};
context.exports=context.module.exports;vm.runInNewContext(result.outputFiles[0].text,context);
const {subscribeLiveRefresh,LIVE_TABLES}=context.module.exports;
async function tick(ms){const end=now+ms;for(;;){const item=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;const[id,t]=item;now=t.at;if(t.delay)t.at+=t.delay;else timers.delete(id);t.fn();await new Promise(r=>setImmediate(r));}now=end;await new Promise(r=>setImmediate(r));}
let a=0,b=0;const offA=subscribeLiveRefresh(()=>{a++}),offB=subscribeLiveRefresh(()=>{b++});
assert.equal(channels,1);assert.equal(events.length,8);assert(!LIVE_TABLES.includes('avaliacoes'));assert(!LIVE_TABLES.includes('profiles'));assert(!LIVE_TABLES.includes('notificacoes'));
await tick(5300);assert.equal(a,1);assert.equal(b,1);
for(let i=0;i<20;i++)events[0].handler({new:{secret:'não deve ser aplicado'}});
await tick(300);assert.equal(a,2);assert.equal(b,2);
document.visibilityState='hidden';await tick(10000);assert.equal(a,2);
document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));await tick(300);assert.equal(a,3);
navigator.onLine=false;await tick(10000);assert.equal(a,3);
navigator.onLine=true;window.dispatchEvent(new Event('online'));await tick(300);assert.equal(a,4);
await tick(5000);assert.equal(a,5);
let finish,reads=0;const offC=subscribeLiveRefresh(()=>{reads++;return new Promise(r=>{finish=r})});
events[0].handler();await tick(300);events[0].handler();await tick(300);assert.equal(reads,1);
finish();await tick(0);offC();offA();offB();assert.equal(removed,1);assert.equal(timers.size,0);
const count=a;window.dispatchEvent(new Event('focus'));events[0].handler();await tick(5000);assert.equal(a,count);
console.log('OK: canal único, oito tabelas, sem notas/perfis, eventos agrupados, fallback, pausa offline/oculta, retomada, sem sobreposição e cleanup.');
