import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const { build } = createRequire(resolve(process.argv[2], 'package.json'))('esbuild');
const bundle = await build({entryPoints:['src/lib/players/evolution.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
const context={module:{exports:{}},exports:{}};context.exports=context.module.exports;
vm.runInNewContext(bundle.outputFiles[0].text,context);
const {pointsPercentage,overallTrend,evolutionAchievements}=context.module.exports;
assert.equal(pointsPercentage({jogos:0,vitorias:0,empates:0}),null);
assert.equal(pointsPercentage({jogos:3,vitorias:1,empates:1}),44.4);
assert.equal(pointsPercentage({jogos:2,vitorias:2,empates:0}),100);
const point=(overall,data)=>({overall,data,racha_id:data});
assert.equal(overallTrend([]),null);
assert.equal(overallTrend([point(80,'2026-01-02')]),null);
for(const [value,expected] of [[85,5],[80,0],[70,-10]])assert.equal(overallTrend([point(value,'2026-01-02'),point(80,'2026-01-01')]),expected);
assert.equal(overallTrend([point(90,'2026-01-01'),point(80,'2026-01-01')]),null);
assert.equal(overallTrend([point(90,null),point(80,null)]),null);
const stats={jogos:0,gols:0,assistencias:0,vitorias:0,empates:0,derrotas:0,rodadas:0,sequencia:0,artilharias:0,destaques:0,garcons:0};
const summary={stats,marcos:{}};
assert.equal(evolutionAchievements(summary).length,21);
assert.equal(evolutionAchievements(summary).filter(a=>a.earned).length,0);
assert.equal(new Set(evolutionAchievements(summary).map(a=>a.id)).size,21);
for(const n of [1,10,25,50]) {
  const a=evolutionAchievements({...summary,stats:{...stats,gols:n},marcos:{['gols-'+n]:{earned:true,data:'2026-01-01'}}}).find(a=>a.id==='gols-'+n);
  assert.equal(a.current,n);assert.equal(a.earned,true);assert.equal(a.date,'2026-01-01');
}
assert.equal(evolutionAchievements({...summary,stats:{...stats,gols:50}}).filter(a=>a.earned).length,0,'Nao inventa medalhas sem agregado oficial');
console.log('PASS V1.2: aproveitamento, tendencias, sem notas, limites, medalhas sem duplicatas e marcos legados');
