// Puente mínimo entre la interfaz (sin Node) y el proceso principal.
// Se expone como window.launcher; si no existe, la interfaz funciona en modo
// navegador con juegos de demostración.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  /** Juegos instalados: [{ id, source, name, lastPlayed, sizeOnDisk, art: { header, hero, logo } }] */
  getLibrary: () => ipcRenderer.invoke('library:get'),
  /** Lanza un juego de la biblioteca. Devuelve { ok, error? }. */
  launch: (id) => ipcRenderer.invoke('game:launch', String(id)),
  /** Añade un juego con el selector de archivos. Devuelve { ok, id?, games?, canceled? }. */
  addGame: () => ipcRenderer.invoke('game:add'),
  /** Quita un juego añadido a mano. Devuelve { ok, games? }. */
  removeGame: (id) => ipcRenderer.invoke('game:remove', String(id)),
  /** Nombre de la distribución de Linux («Ubuntu 24.04.1 LTS»); null en otros sistemas. */
  distroName: () => ipcRenderer.invoke('system:distro'),
  /** Deja de vigilar el juego lanzado (la interfaz vuelve al menú). */
  cancel: () => ipcRenderer.invoke('game:cancel'),
  quit: () => ipcRenderer.invoke('app:quit'),
  /** Apagado instantáneo (Select+Start en el mando; Ctrl+Q lo atiende el proceso principal). */
  powerOff: () => ipcRenderer.invoke('app:power-off'),
  /** Suscripción a { id, state: 'running' | 'exited' | 'failed', error? }. Devuelve la función para cancelarla. */
  onGameState(callback) {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('game:state', listener);
    return () => ipcRenderer.removeListener('game:state', listener);
  },
});
