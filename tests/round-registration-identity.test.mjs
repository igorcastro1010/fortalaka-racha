import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const require = createRequire(resolve(process.argv[2], 'package.json'));
const { JSDOM } = require('jsdom'), { build } = require('esbuild');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
globalThis.window=dom.window; globalThis.document=dom.window.document;
globalThis.HTMLElement=dom.window.HTMLElement; globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const outfile=join(mkdtempSync(join(tmpdir(),'round-identity-')),'test.mjs');
await build({stdin:{contents:`export {createRoot} from 'react-dom/client'; export {act,createElement} from 'react'; export {RachaScreen} from './src/components/rounds/RachaScreen';`,resolveDir:process.cwd()},outfile,bundle:true,format:'esm',platform:'node',jsx:'automatic',tsconfig:resolve('tsconfig.json'),plugins:[{name:'fixture',setup(b){
  b.onResolve({filter:/^@\/lib\//},()=>({path:'data',namespace:'mock'}));
  b.onLoad({filter:/data/,namespace:'mock'},()=>({contents:`const round={roundId:'round',status:'finalizado',participants:[],paymentsAvailable:true}; export const ROUND_DOMAINS=[]; export const isOrganizer=()=>true; export const createClient=()=>({}); export const readRoundView=async()=>round; export const getCurrentRoundDetails=readRoundView; export const getAvailableProfiles=async()=>[]; export const getRoundMatches=async()=>({partidas:[]}); export const retryView=fn=>fn(); export const readMemory=(key,domains,fn)=>fn(); export const addRoundParticipant=()=>{}; export const removeRoundParticipant=()=>{}; export const updateRoundParticipant=()=>{}; export const updateRoundStatus=()=>{}; export const changePaymentMethod=()=>{}; export const paymentMethodLabel=()=>'';`,loader:'js'}));
  b.onResolve({filter:/^\.\/(RoundForm|OwnRegistration|PaymentChoice|RoundFinance|RoundAttendance|RoundSummary)$|^@\/components\/players\/PlayerIdentity$|^@\/components\/live\/useLiveRefresh$/},()=>({path:'children',namespace:'mock'}));
  b.onLoad({filter:/children/,namespace:'mock'},()=>({resolveDir:process.cwd(),contents:`import {createElement as h} from 'react'; export const OwnRegistration=()=>h('section',{'data-registration':true},'Sua inscrição'); export const RoundAttendance=()=>h('section',{'data-attendance':true},'Presença'); export const RoundForm=()=>null; export const PaymentChoice=()=>null; export const RoundFinance=()=>null; export const RoundSummary=()=>null; export const PlayerIdentity=()=>null; export const useLiveRefresh=()=>{};`,loader:'js'}));
}}]});
const {createRoot,act,createElement,RachaScreen}=await import(pathToFileURL(outfile));
const warnings=[]; const originalError=console.error;
console.error=(...args)=>{warnings.push(args.join(' '));};
const root=createRoot(document.getElementById('root'));
try {
  await act(async()=>root.render(createElement(RachaScreen,{profile:{id:'organizer',role:'organizador',active:true}})));
  const original=document.querySelector('[data-registration]');
  assert(original);
  for(let i=0;i<5;i++)for(const label of ['Gestão','Lista']) {
    await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===label).click());
    assert.equal(document.querySelectorAll('[data-registration]').length,1,'Inscricao nao deve acumular ao trocar abas');
    assert.equal(document.querySelector('[data-registration]'),original,'Preservar identidade e estado da inscricao');
    assert.equal(document.querySelectorAll('[data-attendance]').length,label==='Gestão'?1:0);
  }
  assert(!warnings.some(w=>/same key|duplicate key/i.test(w)),warnings.join('\n'));
} finally {await act(async()=>root.unmount());console.error=originalError;dom.window.close();}
console.log('PASS: cinco ciclos Lista/Gestao sem duplicacao, remontagem ou keys repetidas');
process.exit(0);
