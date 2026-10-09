import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/lib/tsc.js');
const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'hc-ts-'));

try {
  for (const [config, output] of [
    ['tsconfig.browser.json', join(temp, 'js')],
    ['tsconfig.worker.json', temp]
  ]) {
    execFileSync(process.execPath, [compiler, '-p', join(root, config), '--outDir', output], { cwd: root, stdio: 'inherit' });
  }
  const files = readdirSync(join(temp, 'js')).filter(file => file.endsWith('.js')).map(file => join('js', file));
  files.push('sw.js');
  for (const file of files) {
    const expected = readFileSync(join(temp, file));
    const committed = readFileSync(join(root, file));
    if (!expected.equals(committed)) throw new Error(`${file} differs from TypeScript output; run npm run build:js`);
  }
  console.log(`TypeScript output matches ${files.length} committed scripts.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
