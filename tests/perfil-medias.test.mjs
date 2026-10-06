import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overallRating, radarPoints } from '../src/lib/ratings/summary.ts';

test('geral usa as cinco médias e muda quando uma delas muda', () => {
  const summary={quantidade:2,passe:8,chute:6,velocidade:9,defesa:5,fisico:7};
  assert.equal(overallRating(summary),70);
  assert.equal(overallRating({...summary,chute:10}),78);
  assert.notEqual(radarPoints(summary),radarPoints({...summary,chute:10}));
});
test('sem avaliações é ausência de nota; zero avaliado é nota válida', () => {
  assert.equal(overallRating({quantidade:0,passe:null,chute:null,velocidade:null,defesa:null,fisico:null}),null);
  assert.equal(overallRating({quantidade:1,passe:0,chute:0,velocidade:0,defesa:0,fisico:0}),0);
});

