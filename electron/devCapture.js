// Sólo para pruebas: con XMB_CAPTURE=<pasos.json> la ventana se abre invisible
// y ejecuta los pasos en orden; después cierra la app. Cada paso puede tener:
//   { "wait": ms }            esperar
//   { "key": "Down" }         pulsar y soltar una tecla (nombres de Electron);
//                             admite "modifiers": ["control", "shift", …]
//   { "js": "expresión" }     evaluar en la página e imprimir el resultado
//   { "shot": "archivo.png" } capturar la ventana (ruta relativa al JSON)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { app } from 'electron';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function runCapture(win, stepsFile) {
  const contents = win.webContents;
  // Avisos y errores de la página (p. ej. bloqueos de la política de contenido).
  contents.on('console-message', (event, legacyLevel, legacyMessage) => {
    const level = event.level ?? ['verbose', 'info', 'warning', 'error'][legacyLevel];
    if (level === 'warning' || level === 'error') console.log(`[renderer ${level}] ${event.message ?? legacyMessage}`);
  });
  const steps = JSON.parse(await readFile(stepsFile, 'utf8'));
  const base = dirname(resolve(stepsFile));
  if (contents.isLoading()) await new Promise((done) => contents.once('did-finish-load', done));

  try {
    for (const step of steps) {
      try {
        if (step.wait) await sleep(step.wait);
        if (step.key) {
          const modifiers = step.modifiers ?? [];
          contents.sendInputEvent({ type: 'keyDown', keyCode: step.key, modifiers });
          contents.sendInputEvent({ type: 'keyUp', keyCode: step.key, modifiers });
          await sleep(step.gap ?? 150);
        }
        if (step.js) {
          const result = await contents.executeJavaScript(step.js);
          console.log(`[capture] ${step.js} → ${JSON.stringify(result)}`);
        }
        if (step.shot) {
          const image = await contents.capturePage();
          await writeFile(resolve(base, step.shot), image.toPNG());
          console.log(`[capture] ${step.shot}`);
        }
      } catch (error) {
        console.log(`[capture] error en ${JSON.stringify(step)}: ${error.message}`); // se sigue con el resto
      }
    }
  } finally {
    app.quit();
  }
}
