import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availabilityError, drawTeams, eligiblePlayers, swapPlayers, validateTeams } from '../src/lib/teams/draw.ts';

const lines = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Jogador ${i}`, tipo: 'linha', status: 'presente' }));
const roster = [...lines,
  { id: 'g1', name: 'Goleiro 1', tipo: 'goleiro_fixo', status: 'presente' },
  { id: 'g2', name: 'Goleiro 2', tipo: 'goleiro_fixo', status: 'presente' },
  { id: 's1', name: 'Suplente', tipo: 'suplente', status: 'presente' },
  { id: 'a1', name: 'Ausente', tipo: 'linha', status: 'ausente' },
  { id: 'r1', name: 'Removido', tipo: 'linha', status: 'removido' },
];

test('considera somente os 20 jogadores de linha presentes', () => {
  assert.deepEqual(eligiblePlayers(roster), lines);
  const teams = drawTeams(roster);
  assert.deepEqual(teams.map(t => t.jogadores.length), [5, 5, 5, 5]);
  assert.equal(validateTeams(teams, roster), '');
  assert.deepEqual(new Set(teams.flatMap(t => t.jogadores)), new Set(lines.map(p => p.id)));
});
test('bloqueia 19 e 21 jogadores, sem completar ou descartar pessoas automaticamente', () => {
  assert.throws(() => drawTeams(lines.slice(1)), { message: availabilityError(19) });
  assert.throws(() => drawTeams([...lines, { ...lines[0], id: 'extra' }]), { message: availabilityError(21) });
});
test('troca 1 por 1 entre times e não altera a entrada', () => {
  const teams = drawTeams(roster, () => 0.5);
  const before = structuredClone(teams);
  const first = teams[0].jogadores[0], second = teams[1].jogadores[0];
  const swapped = swapPlayers(teams, first, second);
  assert.deepEqual(teams, before);
  assert.equal(swapped[0].jogadores[0], second);
  assert.equal(swapped[1].jogadores[0], first);
  assert.equal(validateTeams(swapped, roster), '');
  assert.throws(() => swapPlayers(teams, first, teams[0].jogadores[1]));
  assert.throws(() => swapPlayers(teams, first, 'g1'));
});
test('confirmação rejeita duplicatas, goleiro, outro participante e time com tamanho incorreto', () => {
  const teams = drawTeams(roster);
  for (const badId of ['g1', 's1', 'a1', 'r1', 'outro', teams[1].jogadores[0]]) {
    const bad = structuredClone(teams); bad[0].jogadores[0] = badId;
    assert.notEqual(validateTeams(bad, roster), '');
  }
  const bad = structuredClone(teams); bad[0].jogadores.pop();
  assert.notEqual(validateTeams(bad, roster), '');
  assert.notEqual(validateTeams(teams.slice(1), roster), '');
});
test('sorteio novamente produz distribuição nova e não modifica participantes', () => {
  const before = structuredClone(roster);
  assert.notDeepEqual(drawTeams(roster, () => 0), drawTeams(roster, () => 0.99));
  assert.deepEqual(roster, before);
  assert.throws(() => drawTeams([...lines.slice(1), lines[1]]));
});
