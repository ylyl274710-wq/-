import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, VITE_PERSONAL_ONLY: 'true', VITE_API_ORIGIN: '' };
for (const args of [
  [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit'],
  [join(root, 'node_modules/vite/bin/vite.js'), 'build', ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
