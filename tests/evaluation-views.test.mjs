// node tests/evaluation-views.test.mjs <node_modules com esbuild e jsdom>
// Tambem aceita FORTALAKA_UI_DEPS; sem argumento usa as dependencias do projeto.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { MessageChannel } from 'node:worker_threads';

const root = fileURLToPath(new URL('../', import.meta.url));
const dependencies = createRequire(resolve(process.env.FORTALAKA_UI_DEPS ?? process.argv[2] ?? resolve(root, 'node_modules'), 'package.json'));
const { build } = dependencies('esbuild');
const { JSDOM } = dependencies('jsdom');
const bundle = await build({
  stdin: {
    contents: `
      import { act, createElement } from 'react';
      import { createRoot } from 'react-dom/client';
      import { EvaluationArea } from ${JSON.stringify(resolve(root, 'src/components/ratings/EvaluationArea.tsx'))};
      globalThis.harness = { act, mount(profile) {
        const root = createRoot(document.getElementById('root'));
        root.render(createElement(EvaluationArea, { profile }));
        return root;
      }};
    `,
    resolveDir: root,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  tsconfig: resolve(root, 'tsconfig.json'),
  nodePaths: [resolve(root, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
  plugins: [{
    name: 'evaluation-data-boundaries',
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/ratings\/repository$/ }, () => ({ path: 'ratings', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/components\/rounds\/useCurrentRound$/ }, () => ({ path: 'round', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: path === 'round' ? `
          export function useCurrentRound() {
            return { round: globalThis.fixture.round, loading: false, error: '', retry() {} };
          }
        ` : `
          const fixture = () => globalThis.fixture;
          export async function getEvaluationState(roundId) {
            const f = fixture(); f.reads.push(roundId);
            if (f.readError) throw new Error(f.readError);
            return f.state === null ? null : JSON.parse(JSON.stringify(f.state));
          }
          export async function getEvaluationProgress(roundId) {
            const f = fixture(); f.progressReads.push(roundId);
            return { total: 2, respondentes: 0, abertas: f.state.open };
          }
          export async function setRoundEvaluationsOpen(roundId, open) {
            const f = fixture(); f.toggles.push({ roundId, open });
            f.state.open = open; f.state.canEvaluate = open;
            return { total: 2, respondentes: 0, abertas: open };
          }
          export async function saveEvaluation(...args) { fixture().saves.push(args); }
        `,
      }));
    },
  }],
});

function data() {
  return {
    round: { roundId: 'round-1', roundName: 'Rodada teste', status: 'finalizado', date: '2026-10-25', time: '19:00', address: null },
    state: {
      roundId: 'round-1', roundName: 'Rodada teste', roundStatus: 'finalizado',
      open: true, canEvaluate: true, teamId: 'team-1',
      players: [{ jogador_id: 'player-2', nome: 'Ana', avatar_url: null, avaliado: false, passe: null, chute: null, velocidade: null, defesa: null, fisico: null }],
    },
    reads: [], progressReads: [], toggles: [], saves: [], readError: '',
  };
}

async function render({ organizer = false, state, readError = '' } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fixture = data();
  if (state !== undefined) window.fixture.state = state;
  window.fixture.readError = readError;
  window.IS_REACT_ACT_ENVIRONMENT = true;
  const channels = [];
  window.MessageChannel = class extends MessageChannel {
    constructor() { super(); channels.push(this); }
  };
  window.matchMedia = () => ({ matches: true });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const confirmations = [];
  window.confirm = message => { confirmations.push(message); return true; };
  const intervals = new Map();
  let nextInterval = 0;
  window.setInterval = callback => { intervals.set(++nextInterval, callback); return nextInterval; };
  window.clearInterval = id => intervals.delete(id);
  const errors = [];
  window.console.error = (...args) => errors.push(args);
  window.eval(bundle.outputFiles[0].text);
  const { act, mount } = window.harness;
  let mounted;
  function dispose() {
    for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
    dom.window.close();
  }
  try {
    await act(async () => {
      mounted = mount({ id: 'player-1', name: 'Igor', role: organizer ? 'organizador' : 'jogador', active: true, email: null });
    });
  } catch (error) {
    try { if (mounted) await act(async () => { mounted.unmount(); }); }
    finally { dispose(); }
    throw error;
  }
  const document = window.document;
  function find(selector, predicate = () => true) {
    const element = [...document.querySelectorAll(selector)].find(predicate);
    assert(element, `Missing element: ${selector}`);
    return element;
  }
  async function click(element) {
    assert(!element.disabled, `Disabled control: ${element.textContent}`);
    await act(async () => { element.click(); });
  }
  const tab = label => find('[role="tab"]', element => element.textContent === label);
  const progress = () => find('section', element => element.querySelector('h3')?.textContent === 'Progresso da rodada');
  return {
    fixture: window.fixture, document, find, click, tab, progress, confirmations, errors,
    async close() {
      try {
        await act(async () => { mounted.unmount(); });
        assert.equal(intervals.size, 0, 'Polling timers must be cleaned up on unmount');
      } finally { dispose(); }
    },
  };
}

test('Avaliar/Progresso share one personal read without fetching on tab changes', async () => {
  const app = await render();
  try {
    assert.equal(app.fixture.reads.length, 1);
    assert.equal(app.fixture.progressReads.length, 0);
    for (let i = 0; i < 3; i++) {
      await app.click(app.tab('Progresso'));
      assert.equal(app.progress().closest('[hidden]'), null);
      assert.match(app.progress().textContent, /0 de 1 companheiros avaliados/);
      await app.click(app.tab('Avaliar'));
    }
    assert.equal(app.fixture.reads.length, 1);
    assert.equal(app.fixture.progressReads.length, 0);
    assert(![...app.document.querySelectorAll('summary')].some(element => element.textContent === 'Gerenciar avalia\u00e7\u00f5es'), 'Players must not receive organizer controls');
    assert.equal(app.errors.length, 0);
  } finally { await app.close(); }
});

test('Progresso exposes a failed shared read instead of an infinite spinner', async () => {
  const app = await render({ readError: 'Offline fixture' });
  try {
    await app.click(app.tab('Progresso'));
    assert.match(app.progress().querySelector('[role="alert"]')?.textContent ?? '', /carregar as avalia/);
    assert.equal(app.progress().querySelector('[role="status"][aria-label="Carregando progresso..."]'), null);
    assert.equal(app.fixture.reads.length, 1);
    assert.equal(app.fixture.progressReads.length, 0);
    assert.equal(app.errors.length, 1, 'Only the mocked read failure is expected');
  } finally { await app.close(); }
});

test('Progresso exposes the empty state when the shared read returns null', async () => {
  const app = await render({ state: null });
  try {
    await app.click(app.tab('Progresso'));
    assert.match(app.progress().textContent, /Nenhuma avalia\u00e7\u00e3o dispon\u00edvel/);
    assert.equal(app.progress().querySelector('[role="status"][aria-label="Carregando progresso..."]'), null);
    assert.equal(app.progress().querySelector('[role="alert"]'), null);
    assert.equal(app.fixture.reads.length, 1);
    assert.equal(app.errors.length, 0);
  } finally { await app.close(); }
});

test('Opening/closing evaluations refreshes state without losing the unsaved score or form', async () => {
  const app = await render({ organizer: true });
  try {
    await app.click(app.tab('Avaliar'));
    await app.click(app.find('button[aria-label="Avaliar Ana"]'));
    const score = app.find('button[aria-label="Passe: 5 de 5"]');
    const form = score.closest('[tabindex="-1"]');
    await app.click(score);
    assert.equal(score.getAttribute('aria-pressed'), 'true');
    await app.click(app.tab('Progresso'));
    await app.click(app.find('summary', element => element.textContent === 'Gerenciar avalia\u00e7\u00f5es'));
    for (const [label, open] of [['FECHAR AVALIA\u00c7\u00d5ES', false], ['ABRIR AVALIA\u00c7\u00d5ES', true]]) {
      const before = app.fixture.reads.length;
      await app.click(app.find('button', element => element.textContent === label));
      assert.equal(app.fixture.reads.length, before + 1, 'Mutation must refresh the mounted screen exactly once');
      await app.click(app.tab('Avaliar'));
      assert.equal(app.find('button[aria-label="Passe: 5 de 5"]'), score, 'Score button must retain DOM identity');
      assert.equal(score.closest('[tabindex="-1"]'), form, 'Selected player form must remain mounted');
      assert.equal(score.getAttribute('aria-pressed'), 'true');
      assert.equal(score.disabled, !open, 'Closed evaluations must prevent editing');
      assert.equal(app.find('button', element => element.textContent === 'ENVIAR AVALIA\u00c7\u00c3O').disabled, !open);
      await app.click(app.tab('Progresso'));
    }
    assert.equal(app.fixture.toggles.length, 2);
    assert.deepEqual(Array.from(app.fixture.toggles, item => item.open), [false, true]);
    assert.equal(app.confirmations.length, 2);
    assert.equal(app.fixture.saves.length, 0, 'The draft must not be saved implicitly');
    assert.equal(app.fixture.state.players[0].passe, null);
    assert.equal(app.fixture.progressReads.length, 1);
    assert.equal(app.errors.length, 0);
  } finally { await app.close(); }
});
