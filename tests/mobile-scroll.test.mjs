// UI real + PostgreSQL isolado. --observe registra baseline sem exigir correções.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
const deps=process.argv[2],engines=createRequire(resolve(deps,'package.json'))('playwright'),engine=process.argv.includes('--webkit')?'webkit':'chromium';
const fixture=spawn(process.execPath,['tests/preview-sorteio.mjs',deps,deps,'--app','--payments'],{stdio:['ignore','pipe','inherit']});
let browser;const violations=[];const output=mkdtempSync(join(tmpdir(),'fortalaka-scroll-'));
try{
 await new Promise((done,fail)=>{fixture.stdout.on('data',c=>{if(String(c).includes('Validação isolada:'))done()});fixture.once('error',fail);fixture.once('exit',c=>fail(Error('Fixture saiu '+c)))});
 browser=await engines[engine].launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let unlock;const gate=new Promise(done=>unlock=done);
 await page.route('**/api',async route=>{const body=route.request().postDataJSON();if(body.table==='rachas')await gate;await route.continue().catch(()=>{});});
 await page.goto('http://127.0.0.1:3011/');await page.getByText('Fala, Conta!',{exact:true}).waitFor();await page.waitForTimeout(400);
 const loadingHeading=await page.locator('h2:visible').first().innerText();if(loadingHeading==='Seu próximo racha começa aqui.')violations.push('Carregamento tratado como ausência de rodada');
 await page.screenshot({path:join(output,'loading.png')});unlock();await page.getByRole('button',{name:'Ver racha',exact:true}).waitFor();await page.waitForTimeout(800);
 const before=await page.evaluate(()=>({nodes:document.querySelectorAll('*').length,unvisitedHeadings:[...document.querySelectorAll('h2')].map(e=>e.textContent).filter(t=>['Racha','Times','Resultados','Meu perfil','Avaliação'].includes(t))}));
 if(before.unvisitedHeadings.length)violations.push('Abas nunca visitadas renderizadas em segundo plano');
 const nav=name=>page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name,exact:true}).click();await nav('Racha');await page.getByRole('tab',{name:'Gestão',exact:true}).waitFor();await page.getByRole('link',{name:'Ver perfil de Pessoa 13',exact:true}).waitFor();
 const links=page.locator('a[aria-label^="Ver perfil de"]:visible');const count=await links.count();if(engine==='chromium'){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 for(let pass=0;pass<3;pass++)for(const index of [0,Math.floor(count/2),count-1]){await links.nth(index).scrollIntoViewIfNeeded();await page.waitForTimeout(50);const box=await links.nth(index).boundingBox();assert(box&&box.height>=40);assert(await links.nth(index).isVisible());}
 await page.screenshot({path:join(output,'list-bottom.png')});await nav('Início');await nav('Racha');assert.equal(await links.count(),count,'Lista preservada após retornar');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,loadingHeading,home:before,participants:count,scrollPasses:3,consoleErrors:errors,violations,output},null,2));
 if(!process.argv.includes('--observe'))assert.deepEqual(violations,[]);
}finally{await browser?.close();fixture.kill();}
