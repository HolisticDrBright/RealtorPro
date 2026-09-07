import { createRequire } from 'node:module';
import net from 'node:net';
const require = createRequire(import.meta.url);
try { require('@next/env').loadEnvConfig(process.cwd()); }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
const open = await new Promise((resolve) => {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  const finish = (result) => { socket.destroy(); resolve(result); };
  socket.setTimeout(1000);
  socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.once('timeout', () => finish(false));
});
if (open) {
  console.error(`Setup stopped: port ${port} is in use. Quit the running app with Control-C before installing or migrating. No process was killed.`);
  process.exitCode = 1;
}
