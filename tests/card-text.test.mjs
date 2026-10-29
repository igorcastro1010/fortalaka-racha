import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapCardText } from '../src/lib/results/card-text.ts';
const measure = value => [...value].length;
test('preserva palavras inteiras nos nomes que cabem', () => {
  assert.deepEqual(wrapCardText('Ana Maria Silva', 9, measure), ['Ana Maria', 'Silva']);
  assert.deepEqual(wrapCardText('  Ana   Maria  ', 9, measure), ['Ana Maria']);
});
test('limita linhas com reticências e acomoda sobrenome sem espaços', () => {
  assert.deepEqual(wrapCardText('Ana Albuquerque Sobrenome', 12, measure), ['Ana', 'Albuquerque…']);
  assert.deepEqual(wrapCardText('abcdefghijklmnopqrst', 6, measure), ['abcdef', 'ghijk…']);
});
test('preserva Unicode e trata texto ou largura vazios', () => {
  assert.deepEqual(wrapCardText('😀😀😀😀😀', 3, measure), ['😀😀😀', '😀😀']);
  assert.deepEqual(wrapCardText('', 12, measure), []);
  assert.deepEqual(wrapCardText('Ana', 0, measure), []);
});
