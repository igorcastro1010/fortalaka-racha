// Componentes reais + PostgreSQL local, duas sessões, sem Supabase remoto.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const deps=process.argv[2];const {chromium}=createRequire(resolve(deps,'package.json'))('playwright');
const fixture=spawn(process.execPath,['tests/preview-sorteio.mjs',deps,deps,'--app'],{stdio:['ignore','pipe','inherit']});
let browser;
try{
 await new Promise((done,fail)=>{fixture.stdout.on('data',c=>{if(String(c).includes('Validação isolada:'))done()});fixture.once('error',fail);fixture.once('exit',c=>fail(Error('Fixture encerrou: '+c)));});
 browser=await chromium.launch({headless:true});
 const organizer=await browser.newContext(),viewer=await browser.newContext();
 const a=await organizer.newPage(),b=await viewer.newPage();const errors=[];
 for(const p of[a,b])p.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:3011';
 await a.goto(base+'/?role=organizador');await b.goto(base+'/?role=jogador');
 const nav=(p,name)=>p.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name,exact:true}).click();
 await nav(a,'Racha');await a.getByRole('tab',{name:'Gestão',exact:true}).click();
 await a.getByText('EDITAR DADOS DA RODADA',{exact:true}).click();
 await a.getByLabel('Endereço',{exact:true}).fill('RASCUNHO DA ARENA');
 const c=await organizer.newPage();await c.goto(base+'/?role=organizador');
 await nav(c,'Racha');await c.getByRole('tab',{name:'Gestão',exact:true}).click();
 await c.getByRole('button',{name:'Fechar lista',exact:true}).click();await c.getByRole('button',{name:'Confirmar',exact:true}).click();
 await b.getByText('Lista fechada',{exact:true}).waitFor({timeout:12000});
 assert.equal(await a.getByLabel('Endereço',{exact:true}).inputValue(),'RASCUNHO DA ARENA');
 await a.getByRole('button',{name:'Descartar alterações',exact:true}).click();await c.close();
 await a.getByRole('button',{name:'Reabrir lista',exact:true}).waitFor({timeout:12000});
 await nav(a,'Times');await a.getByRole('tab',{name:'Ajustes',exact:true}).click();
 await nav(b,'Times');
 await a.getByRole('button',{name:'Sortear times',exact:true}).click();
 await a.getByRole('button',{name:'Confirmar times',exact:true}).click();await a.getByRole('button',{name:'Confirmar',exact:true}).click();
 await b.getByText('Times confirmados',{exact:true}).waitFor({timeout:12000});
 await nav(a,'Resultados');await nav(b,'Resultados');
 await b.getByText('Nenhuma partida ainda',{exact:true}).waitFor();
 let release,started,finished,held=false;
 const pending=new Promise(done=>{started=done}),done=new Promise(done=>{finished=done});
 await b.route('**/api',async route=>{
   const body=route.request().postDataJSON();
   if(body.name!=='ler_partidas_rodada'||held){await route.continue();return;}
   held=true;const response=await route.fetch();
   const gate=new Promise(done=>{release=done});started();await gate;
   await route.fulfill({response});finished();
 });
 await pending;
 await a.getByRole('button',{name:'INICIAR PRIMEIRA PARTIDA',exact:true}).click();
 await b.locator('p.text-6xl').first().waitFor({timeout:12000});
 release();await done;
 await b.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 assert.equal(await b.locator('p.text-6xl').count(),2,'Resposta antiga não apaga a partida nova');
 await b.unroute('**/api');
 await a.getByRole('button',{name:/Aumentar placar de/}).first().click();
 await a.getByRole('button',{name:'Salvar',exact:true}).click();
 await b.locator('p.text-6xl').filter({hasText:/^1$/}).waitFor({timeout:12000});
 // Uma nova rodada não pode desmontar a edição em andamento no outro aparelho.
 await a.getByRole('button',{name:'LANÇAR PLACAR E EVENTOS',exact:true}).click();
 await a.getByRole('button',{name:/Aumentar placar de/}).last().click();
 const scores=await a.locator('p.text-6xl').allTextContents();
 const r=await a.request.post(base+'/api',{data:{kind:'table',table:'rachas',op:'insert',role:'organizador',value:{id:crypto.randomUUID(),nome:'Rodada nova isolada',data:'2026-11-20'}}});
 assert.equal((await r.json()).error,null);
 await b.getByText('Rodada nova isolada',{exact:true}).waitFor({timeout:12000});
 assert.deepEqual(await a.locator('p.text-6xl').allTextContents(),scores);
 assert(await a.getByRole('button',{name:'Salvar',exact:true}).isVisible());
 await a.getByRole('button',{name:'Fechar edicao sem salvar',exact:true}).click();
 await a.getByText('Rodada nova isolada',{exact:true}).waitFor({timeout:12000});
 assert.equal(await b.evaluate(()=>performance.getEntriesByType('navigation').length),1);
 assert.deepEqual(errors,[]);
 console.log('OK: sessões sincronizadas sem reload, formulário e placar preservados, resposta antiga descartada e nova rodada sincroniza após fechar edição.');
}finally{await browser?.close();fixture.kill();}
