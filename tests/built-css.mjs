import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Next.js emite CSS em locais diferentes com Turbopack e Webpack.
export function readBuiltCss() {
  const files = ['.next/static/chunks', '.next/static/css'].flatMap(dir => existsSync(dir) ? readdirSync(dir).filter(n => n.endsWith('.css')).map(n => join(dir, n)) : []);
  if (!files.length) throw new Error('Execute um build Next.js antes dos testes de navegador.');
  return files.map(file => readFileSync(file, 'utf8')).join('\n');
}
