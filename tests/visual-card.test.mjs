import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankingVisualCard, roundVisualCard } from '../src/lib/results/visual-card.ts';
test('ranking limita top 5, identifica filtro e oculta nota insuficiente',()=>{
 const rows=Array.from({length:8},(_,i)=>({jogador_id:String(i),nome:'Nome longo '+i,avatar_url:null,gols:10-i,nota_geral_100:80,quantidade_avaliacoes:i?2:1}));
 const card=rankingVisualCard(rows,'nota','Nota');assert.equal(card.rows.length,5);assert.equal(card.rows[0].value,'--');assert.match(card.subtitle,/Nota/);assert(!JSON.stringify(card).includes('jogador_id'));
});
test('card da rodada preserva totais e ausências reais',()=>{
 const summary={date:'2026-10-29',participantCount:8,totalGoals:4,matches:[{},{}],topScorers:[],assists:[],wins:[]};
 assert.equal(roundVisualCard(summary,'resultado').facts[0].value,'8');
 assert.equal(roundVisualCard(summary,'artilharia').rows.length,0);
});
