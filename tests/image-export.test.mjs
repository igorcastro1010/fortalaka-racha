import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawAvatar, saveCardImage } from '../src/lib/results/image-export.ts';

test('avatar recorta fotos horizontais, verticais e quadradas sem distorcer', () => {
  for (const [width, height, expected] of [[800, 400, [200, 0, 400, 400]], [400, 800, [0, 200, 400, 400]], [400, 400, [0, 0, 400, 400]]]) {
    const image = { naturalWidth: width, naturalHeight: height };
    drawAvatar({ drawImage: (...args) => assert.deepEqual(args, [image, ...expected, 145, 19, 78, 78]) }, image, 145, 19, 78);
  }
});

test('salvar usa arquivo PNG no menu nativo; cancelar nao baixa nada', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    let called = false;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      canShare: () => true,
      share: async ({ files }) => { called = true; assert.equal(files[0].type, 'image/png'); },
    } });
    const pending = saveCardImage(new Blob(['png']), 'blob:test');
    assert.equal(called, true, 'share precisa ser chamado antes de perder o gesto do usuario');
    assert.equal(await pending, 'shared');
    navigator.share = async () => { throw new DOMException('cancel', 'AbortError'); };
    assert.equal(await saveCardImage(new Blob(), 'blob:test'), 'cancelled');
    navigator.share = async () => { throw new Error('failed'); };
    await assert.rejects(saveCardImage(new Blob(), 'blob:test'), /failed/);
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

test('navegador sem compartilhamento baixa PNG sem abrir preview', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldDocument = globalThis.document;
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    let clicked = false, removed = false;
    const link = { click() { clicked = true; }, remove() { removed = true; } };
    globalThis.document = { createElement: () => link, body: { appendChild() {} } };
    assert.equal(await saveCardImage(new Blob(), 'blob:test'), 'downloaded');
    assert.equal(link.download, 'fortalaka-story.png');
    assert.equal(link.href, 'blob:test');
    assert(clicked && removed);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    if (oldDocument) globalThis.document = oldDocument; else delete globalThis.document;
  }
});
