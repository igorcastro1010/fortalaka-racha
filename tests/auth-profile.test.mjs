// Projeção real do perfil com cliente isolado; sem credenciais ou acesso remoto.
// node tests/auth-profile.test.mjs <diretório com esbuild>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const { build } = createRequire(resolve(process.argv[2], 'package.json'))('esbuild');
const output = mkdtempSync(join(tmpdir(), 'fortalaka-auth-profile-'));
const client = join(output, 'server.ts');
writeFileSync(client, `
export async function createClient() {
  const fixture = globalThis.__profileFixture;
  return {
    auth: { getUser: async () => ({ data: { user: fixture.user } }) },
    from(table) {
      fixture.tables.push(table);
      const query = {
        select(fields) { fixture.fields = fields.split(',').map(s => s.trim()); return query; },
        eq(key, value) { fixture.filter = [key, value]; return query; },
        async maybeSingle() {
          return { data: fixture.profile && Object.fromEntries(fixture.fields.map(k => [k, fixture.profile[k]])) };
        }
      };
      return query;
    }
  };
}
`);
const bundle = join(output, 'profile.cjs');
await build({
  entryPoints: [resolve('src/lib/auth/get-profile.ts')], outfile: bundle,
  bundle: true, platform: 'node', format: 'cjs', tsconfig: resolve('tsconfig.json'),
  plugins: [{ name: 'isolated-auth', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({ path: client }));
  } }],
});
const { getCurrentUserProfile } = createRequire(import.meta.url)(bundle);
try {
  const profile = { id: 'jogador-a', name: 'Igão', avatar_url: 'https://example.invalid/avatar.png', role: 'jogador', active: true };
  globalThis.__profileFixture = { user: { id: profile.id }, profile, tables: [] };
  const result = await getCurrentUserProfile();
  assert.equal(result.profile.avatar_url, profile.avatar_url, 'A foto precisa chegar ao shell após recarregar');
  assert.deepEqual(globalThis.__profileFixture.filter, ['id', profile.id]);
  assert.deepEqual(globalThis.__profileFixture.tables, ['profiles']);
  globalThis.__profileFixture = { user: null, profile, tables: [] };
  assert.deepEqual(await getCurrentUserProfile(), { user: null, profile: null });
  assert.deepEqual(globalThis.__profileFixture.tables, [], 'Anônimo não consulta profiles');
  globalThis.__profileFixture = { user: { id: profile.id }, profile: null, tables: [] };
  assert.equal((await getCurrentUserProfile()).profile, null);
  console.log('PASS perfil autenticado preserva foto, filtra identidade e não consulta dados como anônimo');
} finally {
  delete globalThis.__profileFixture;
}
