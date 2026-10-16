import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(path, entry.name)) : join(path, entry.name)))).flat();
}

for (const path of await walk('extension')) {
  if (!path.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3 || manifest.host_permissions?.length || manifest.content_scripts?.length) throw new Error('A coleta deve usar Manifest V3 e acesso opcional por domínio, sem injeção de scripts.');
for (const file of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page]) await readFile(join('extension', file));
console.log('Manifesto, arquivos de entrada e sintaxe JavaScript verificados.');
