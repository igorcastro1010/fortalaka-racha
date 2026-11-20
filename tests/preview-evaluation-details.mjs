// Isolated UI fixture. No credentials or remote database calls.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { readBuiltCss } from './built-css.mjs';
const { build } = createRequire(resolve(process.argv[2], 'package.json'))('esbuild');
const output = mkdtempSync(join(tmpdir(), 'fortalaka-rating-details-'));
const mock = join(output, 'ratings.ts');
writeFileSync(mock, `
export async function getEvaluationRounds(){return [{id:'current',nome:'Rodada teste',data:'2026-11-19'},{id:'old',nome:'Rodada anterior',data:'2026-11-12'},{id:'empty',nome:'Sem avaliações',data:null},{id:'error',nome:'Erro de teste',data:null}];}
export async function getEvaluationDetails(id){
 if(id==='error')throw Error('Falha de teste');
 if(id==='empty')return [];
 return [{avaliador_id:'a',avaliador_nome:'Avaliador com nome muito longo para testar no celular',avaliado_id:'b',avaliado_nome:'Jogador avaliado com nome extenso',avaliado_avatar:null,avaliado:true,passe:id==='old'?1:5,chute:4,velocidade:3,defesa:2,fisico:1},
 {avaliador_id:'a',avaliador_nome:'Avaliador com nome muito longo para testar no celular',avaliado_id:'c',avaliado_nome:'Companheiro pendente',avaliado_avatar:null,avaliado:false}];
}`);
const entry = join(output, 'main.tsx');
writeFileSync(entry, `import {createRoot} from 'react-dom/client';
import {EvaluationDetails} from ${JSON.stringify(resolve('src/components/ratings/EvaluationDetails.tsx'))};
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-[430px] p-4"><h1 className="text-xl font-black">Avaliações · teste isolado</h1><EvaluationDetails roundId="current"/></main>);`);
await build({ entryPoints: [entry], outfile: join(output, 'app.js'), bundle: true, jsx: 'automatic', tsconfig: resolve('tsconfig.json'), nodePaths: [resolve('node_modules')], plugins: [{name:'isolated',setup(b){
  b.onResolve({filter:/^@\/lib\/ratings\/repository$/},()=>({path:mock}));
  b.onResolve({filter:/^@\/lib\/live\/refresh$/},()=>({path:'refresh',namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function subscribeLiveRefresh(){return ()=>{};}',loader:'js'}));
}}] });
writeFileSync(join(output,'app.css'),readBuiltCss());
const server=createServer((req,res)=>{
  if(req.url==='/app.js'||req.url==='/app.css'){
    res.setHeader('Content-Type',req.url.endsWith('js')?'text/javascript':'text/css');
    res.end(readFileSync(join(output,req.url.slice(1))));return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Notas: teste isolado</title><div id="root"></div><script src="/app.js"></script></html>');
});
server.listen(3016,'127.0.0.1',()=>console.log('Isolated rating details: http://127.0.0.1:3016'));
