// Puente mínimo entre la interfaz (sin Node) y el proceso principal.
// Se expone como window.launcher; si no existe, la interfaz funciona en modo
// navegador con juegos de demostración.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  /** Juegos instalados: [{ id, source, name, lastPlayed, sizeOnDisk, art: { header, hero, logo } }] */
  getLibrary: () => ipcRenderer.invoke('library:get'),
  /** Lanza un juego detectado. Devuelve { ok, error? }. */
  launch: (id) => ipcRenderer.invoke('game:launch', String(id)),
  /** Deja de vigilar el juego lanzado (la interfaz vuelve al menú). */
  cancel: () => ipcRenderer.invoke('game:cancel'),
  quit: () => ipcRenderer.invoke('app:quit'),
  /** Apagado instantáneo (Select+Start en el mando; Ctrl+Q lo atiende el proceso principal). */
  powerOff: () => ipcRenderer.invoke('app:power-off'),
  /** Suscripción a { id, state: 'running' | 'exited' }. Devuelve la función para cancelarla. */
  onGameState(callback) {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('game:state', listener);
    return () => ipcRenderer.removeListener('game:state', listener);
  },
});
