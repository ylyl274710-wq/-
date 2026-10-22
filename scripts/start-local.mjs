import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const flag = process.argv.indexOf('--port');
const port = flag === -1 ? 5173 : Number(process.argv[flag + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口必须是1024–65535之间的整数');
const hostFlag = process.argv.indexOf('--host');
const host = hostFlag === -1 ? '127.0.0.1' : process.argv[hostFlag + 1];
if (!host || !/^(127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host) || host.split('.').some(n => Number(n) > 255)) throw new Error('请使用本机的私有局域网 IPv4 地址');
const url = `http://${host}:${port}/`;
try { const health = await fetch('http://127.0.0.1:5175/api/health', { signal: AbortSignal.timeout(700) }); if (!health.ok) throw new Error(); }
catch {
  const logs = join(projectRoot, '.verification'); mkdirSync(logs, { recursive: true }); const log = openSync(join(logs, 'studio-api.log'), 'a');
  const api = spawn(process.execPath, [join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(projectRoot, 'server', 'index.ts')], { cwd: projectRoot, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  api.on('error', error => console.error('联机服务启动失败：', error.message)); closeSync(log); api.unref();
  if (api.pid) writeFileSync(join(logs, 'studio-api.pid'), String(api.pid));
}

async function status() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(700) });
    const body = await response.text();
    return response.ok && body.includes('片刻拼图') ? 'running' : 'occupied';
  } catch { return 'offline'; }
}

const current = await status();
if (current === 'occupied') throw new Error(`端口${port}已被其他网页服务使用，请换一个端口`);
if (current === 'running') {
  console.log(`拼图已经运行，刷新页面即可：${url}`);
} else {
  const vite = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(vite)) throw new Error('请先在项目目录运行 npm install');
  const logs = join(projectRoot, '.verification');
  mkdirSync(logs, { recursive: true });
  const log = openSync(join(logs, `preview-${port}.log`), 'a');
  const child = spawn(process.execPath, [vite, '--host', host, '--port', String(port), '--strictPort'],
    { cwd: projectRoot, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.on('error', error => { console.error('本地启动失败：', error.message); process.exitCode = 1; });
  closeSync(log); child.unref();
  if (child.pid) writeFileSync(join(logs, `preview-${port}.pid`), String(child.pid));
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await status() === 'running') { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('本地服务未能启动，请查看 .verification 中的启动日志');
  console.log(`拼图已在后台启动：${url}`);
  console.log('关闭此终端不会停止游戏服务。');
}
