// `npm run icon`: genera build/icon.ico (y build/icon.png) a partir de
// public/favicon.svg, para el acceso directo y la ventana de la app.
// Se ejecuta con Electron: el SVG se dibuja en un <canvas> de una ventana
// oculta (conserva la transparencia y dibuja cada tamaño en vectorial).
import { app, BrowserWindow } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [256, 64, 48, 32, 16];

// Contenedor ICO con imágenes PNG dentro (válido desde Windows Vista).
function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(pngs.length, 4);
  const entries = Buffer.alloc(16 * pngs.length);
  let offset = header.length + entries.length;
  pngs.forEach(({ size, data }, i) => {
    const at = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, at); // 0 significa 256
    entries.writeUInt8(size >= 256 ? 0 : size, at + 1);
    entries.writeUInt16LE(1, at + 4); // planos
    entries.writeUInt16LE(32, at + 6); // bits por píxel
    entries.writeUInt32LE(data.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, entries, ...pngs.map((p) => p.data)]);
}

const RASTERIZE = (svgDataUrl, sizes) => `(async () => {
  const img = new Image();
  img.src = ${JSON.stringify(svgDataUrl)};
  await img.decode();
  return ${JSON.stringify(sizes)}.map((size) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(img, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  });
})()`;

app.whenReady().then(async () => {
  try {
    const svg = await readFile(join(root, 'public', 'favicon.svg'));
    const win = new BrowserWindow({ show: false });
    await win.loadURL('about:blank');
    const urls = await win.webContents.executeJavaScript(
      RASTERIZE(`data:image/svg+xml;base64,${svg.toString('base64')}`, SIZES),
    );
    const pngs = urls.map((url, i) => ({ size: SIZES[i], data: Buffer.from(url.split(',')[1], 'base64') }));
    await mkdir(join(root, 'build'), { recursive: true });
    await writeFile(join(root, 'build', 'icon.ico'), toIco(pngs));
    await writeFile(join(root, 'build', 'icon.png'), pngs[0].data);
    console.log('build/icon.ico y build/icon.png generados');
  } catch (error) {
    console.error('No se pudo generar el icono:', error);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
