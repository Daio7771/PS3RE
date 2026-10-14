# PS3 Reimagined (Experiment)

Una interfaz al estilo del **XMB de la PS3** para lanzar los juegos de tu PC,
como Steam Big Picture pero con el menú de la consola. Es una app de escritorio
para **Windows y Linux** hecha con HTML, CSS y JavaScript puro (Vite) y Electron.

Proyecto de fans: **no usa ningún recurso de Sony**. Los iconos son SVG
propios, los sonidos se sintetizan en tiempo real con Web Audio y el fondo es
un shader WebGL original.

> [!IMPORTANT]
> **Esto es un experimento, no un producto.** Nació para responder a una
> pregunta: *¿hasta dónde se puede llegar construyendo una app completa
> dirigiendo a una IA, sin escribir el código a mano?* No pretende competir con
> otros lanzadores ni presentarse como trabajo de un programador profesional.

> [!NOTE]
> **Proyecto hecho con IA («vibe coding»).** El código, los gráficos SVG, los
> sonidos y la documentación los ha generado una inteligencia artificial
> ([Claude](https://www.anthropic.com/claude), de Anthropic, mediante Claude
> Code). El papel de Daio7771 ha sido idear el proyecto, decidir cada fase,
> probarlo en su equipo y revisar el resultado.

## Sobre el experimento

**Qué es:**

- Una prueba de concepto para ver qué tal sale un proyecto de varias fases
  hecho con IA: interfaz, gráficos, audio, integración con Windows y tiendas
  de juegos.
- Un proyecto personal y de fans, compartido por si a alguien le resulta
  curioso o útil.

**Qué no es:**

- No es software terminado ni mantenido como tal: puede tener fallos, cambiar
  mucho entre versiones o quedarse parado.
- No es una muestra de habilidad programando «a mano», y no lo pretende.
- No sustituye a Steam Big Picture ni a otros lanzadores serios.

Si lo pruebas, úsalo con esa idea en mente. Las críticas constructivas, los
fallos encontrados y las ideas son bienvenidos en los
[issues](https://github.com/Daio7771/PS3RE/issues).

## Qué hace

- **XMB**: fondo animado de ondas (WebGL, limitado a 60 fps aunque el monitor
  vaya más rápido), barra de categorías **Ajustes · Juego · Red**, columnas de
  elementos, submenús y paneles de opciones con vista previa en vivo.
- **Tus juegos**: detecta los instalados en **Steam** (en Windows también
  **EA app** y **Ubisoft Connect**), con sus carátulas de la caché local de
  Steam y ordenados por la última partida. Lo que falte lo añades tú desde
  **Juego → Añadir juego**.
- **Lanzar y volver**: al elegir un juego aparece una pantalla de «Iniciando…»
  con su arte; la app se minimiza mientras juegas y vuelve sola al cerrarlo.
- **Teclado y mando** (Gamepad API), con repetición al mantener pulsado.
- **Sonidos y arranque**: efectos de navegación y una secuencia de arranque
  propios, todo sintetizado.
- **Ajustes reales**: color de fondo, volumen de los sonidos, secuencia de
  arranque y paneles informativos con datos de tu equipo (GPU, pantalla,
  frecuencia medida del monitor, audio, red, mandos…).

## En Linux (AppImage)

Baja el `.AppImage` de la [última versión](https://github.com/Daio7771/PS3RE/releases/latest),
dale permiso de ejecución y ábrelo. No hay que instalar nada más:

```bash
chmod +x PS3-Reimagined-*.AppImage
./PS3-Reimagined-*.AppImage
```

Va en Ubuntu, Debian, Arch y casi cualquier distribución de 64 bits.

- **Steam** se encuentra solo, tanto si lo instalaste con la distribución
  como con Flatpak o Snap.
- **El resto de juegos** los añades desde **Juego → Añadir juego**: el
  ejecutable, un AppImage, un script `.sh` o un acceso directo `.desktop` (los
  que crean Heroic, Lutris o Steam; suelen estar en
  `~/.local/share/applications`, pulsa Ctrl+H para ver carpetas ocultas).
- EA app y Ubisoft Connect no existen para Linux. Si los usas a través de
  Heroic, Lutris o Bottles, añade el acceso directo del juego.

> [!TIP]
> En Wayland (sobre todo en GNOME) puede que la app no vuelva sola al frente
> al cerrar el juego: el escritorio no deja que una ventana se ponga delante
> por su cuenta. Haz clic en su icono y listo.

## Juegos añadidos a mano

Se guardan en `games.json`, dentro de la carpeta de datos de la app
(`~/.config/ps3-reimagined/` en Linux, `%APPDATA%\ps3-reimagined\` en Windows).
Lo normal es añadirlos desde el XMB, pero el archivo se puede editar a mano,
por ejemplo para ponerles carátula:

```json
{
  "games": [
    {
      "name": "Celeste",
      "command": "~/Juegos/Celeste/Celeste",
      "args": ["--fullscreen"],
      "cover": "~/Imágenes/celeste.jpg",
      "background": "~/Imágenes/celeste-fondo.jpg",
      "logo": "~/Imágenes/celeste-logo.png"
    }
  ]
}
```

Sólo son obligatorios `name` y `command` (o `uri`, p. ej. `heroic://…`).
También admite `cwd`, `env` y `process` (el nombre del proceso del juego, por
si se abre a través de otro programa y hay que saber cuándo termina). Para
quitar uno: △ sobre el juego → **Quitar de la lista** (no borra nada del disco).

## Desde el código

Requisitos:

- Windows 10/11 o Linux.
- [Node.js](https://nodejs.org) 20.19 o superior (o 22.12+).
- Opcional: Steam (o EA app / Ubisoft Connect en Windows) con algún juego instalado.

```bash
git clone https://github.com/Daio7771/PS3RE.git
cd PS3RE
npm install
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Abre la app con recarga en caliente de la interfaz (desarrollo). |
| `npm start` | Compila la interfaz y abre la app. |
| `npm run shortcut` | Crea el acceso directo **PS3 Reimagined** en el escritorio (sólo Windows; abre la app sin consola). |
| `npm run dist:linux` | Genera el AppImage de Linux en `release/`. |
| `npm run dev:web` | Sólo la interfaz en el navegador, con juegos de demostración (no lanza nada). |
| `npm run icon` | Regenera `build/icon.ico` a partir de `public/favicon.svg`. |

## Controles

| Acción | Teclado | Mando |
|---|---|---|
| Moverse | Flechas | Cruceta o stick izquierdo |
| Confirmar / lanzar | Intro o Espacio | Botón inferior (✕ / A) |
| Volver | Esc o Retroceso | Botón derecho (○ / B) |
| Opciones del juego (△) | T | Botón superior (△ / Y) |
| Pantalla completa | F11 | — |
| **Apagar al instante** | **Ctrl+Q** | **Select + Start** |

También puedes apagar desde Ajustes → Ajustes del sistema → Apagar el sistema.

## Estructura

```
electron/          Proceso principal: ventana, lanzador y bibliotecas de juegos
  library/         Steam, EA app y Ubisoft Connect (sólo lectura), juegos
                   añadidos a mano y lo propio de cada sistema (Windows / Linux)
src/
  xmb/             Lógica: navegación, entrada, audio, fondo, paneles de información
  ui/              Vistas y estilos del XMB, arranque y pantalla de lanzamiento
  shaders/         Shader GLSL del fondo
  config/          Configuración central (colores, medidas, tiempos…)
  launcher/        Biblioteca de juegos en la interfaz
scripts/           Arranque en desarrollo, icono y acceso directo
```

## Privacidad y seguridad

- Todo funciona en local. La app no se conecta a ningún servidor; la única
  salida a Internet es abrir este repositorio en tu navegador si lo pides
  desde Ajustes → Información.
- Las bibliotecas se leen en modo **sólo lectura** (registro de Windows,
  archivos de cada tienda y `/proc` en Linux). Los juegos de tienda se lanzan
  a través de ella (`steam://`, `link2ea://`, `uplay://`), como lo haría la
  propia tienda; los añadidos a mano, tal cual los elegiste.
- Lo único que la app toca fuera de su carpeta: si eliges como juego un
  ejecutable sin permiso de ejecución (típico de un AppImage recién bajado),
  se lo da, sólo para tu usuario.
- La interfaz no tiene acceso a Node.js (aislamiento de contexto y sandbox) y
  sólo puede pedir lanzar juegos de la biblioteca: los detectados y los que
  hayas elegido tú con el selector de archivos del sistema.

## Aviso legal

PS3 Reimagined es un proyecto de fans sin relación con Sony Interactive
Entertainment. «PlayStation» y «PS3» son marcas de sus respectivos
propietarios. Los juegos y sus carátulas pertenecen a sus dueños; las carátulas
se leen de la caché local de Steam de tu equipo y no forman parte de este
repositorio.

## Licencia

[MIT](LICENSE) © Daio7771. Componentes de terceros en
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
