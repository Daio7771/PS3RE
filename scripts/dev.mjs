// `npm run dev`: servidor de Vite + la app de Electron apuntando a él.
// Al cerrar la app (o apagarla con Ctrl+Q / Select+Start) termina todo al
// instante, servidor incluido.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electronPath from 'electron';

const server = await createServer();
await server.listen();
server.printUrls();

const url = server.resolvedUrls.local[0];
const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

// Sin esperar a que el servidor cierre sus conexiones: el proceso termina y
// se lo lleva por delante.
electron.on('exit', (code) => process.exit(code ?? 0));

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => electron.kill());
