// Accesos directos de Linux (.desktop, especificación de freedesktop.org):
// lo justo para sacar el nombre y la orden de un juego. Los crean Steam,
// Heroic, Lutris, itch, los instaladores de GOG, etc.

/** Idiomas preferidos para Name[…], del más concreto al más general («es_ES», «es»). */
export function preferredLocales(env = process.env) {
  const raw = env.LC_ALL || env.LC_MESSAGES || env.LANG || '';
  const locale = raw.split('.')[0].split('@')[0];
  const list = [];
  if (locale && locale !== 'C' && locale !== 'POSIX') {
    list.push(locale);
    const lang = locale.split('_')[0];
    if (lang !== locale) list.push(lang);
  }
  if (!list.includes('es')) list.push('es'); // la interfaz está en español
  return list;
}

// Escapes de los valores de tipo cadena: \s \n \t \r \\.
function unescapeValue(value) {
  return value.replace(/\\([sntr\\])/g, (_, c) => ({ s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\' })[c]);
}

/**
 * Lee el grupo [Desktop Entry]. Devuelve { type, name, exec, path, url,
 * hidden } con los valores ya sin escapes (exec sin trocear todavía).
 */
export function parseDesktopEntry(text, locales = preferredLocales()) {
  const values = new Map();
  let inEntry = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      inEntry = line === '[Desktop Entry]';
      continue;
    }
    if (!inEntry) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!values.has(key)) values.set(key, unescapeValue(line.slice(eq + 1).trim()));
  }
  const localized = (key) => {
    for (const locale of locales) {
      if (values.has(`${key}[${locale}]`)) return values.get(`${key}[${locale}]`);
    }
    return values.get(key) ?? null;
  };
  return {
    type: values.get('Type') ?? null,
    name: localized('Name'),
    exec: values.get('Exec') ?? null,
    path: values.get('Path') || null,
    url: values.get('URL') || null,
    hidden: values.get('Hidden') === 'true',
  };
}

// Códigos de campo de Exec (%f, %U…): aquí no se abre ningún archivo, así
// que se quitan. «%%» es un «%» literal.
const FIELD_CODE = /%([fFuUdDnNickvm%])/g;

/**
 * Trocea una línea de órdenes con las reglas de Exec: argumentos separados
 * por espacios, comillas dobles y «\» para escapar. Quita los códigos de
 * campo. Devuelve [] si está vacía o mal cerrada.
 */
export function splitCommandLine(line) {
  const args = [];
  let current = '';
  let started = false;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '\\' && i + 1 < line.length) {
        current += line[++i];
      } else if (c === '"') {
        quoted = false;
      } else {
        current += c;
      }
    } else if (c === '"') {
      quoted = true;
      started = true;
    } else if (c === '\\' && i + 1 < line.length) {
      current += line[++i];
      started = true;
    } else if (/\s/.test(c)) {
      if (started) args.push(current);
      current = '';
      started = false;
    } else {
      current += c;
      started = true;
    }
  }
  if (quoted) return []; // comillas sin cerrar: orden no válida
  if (started) args.push(current);
  return args
    .map((arg) => {
      // Un código de campo suelto desaparece; dentro de un argumento, sólo él.
      if (/^%[fFuUdDnNickvm]$/.test(arg)) return null;
      return arg.replace(FIELD_CODE, (_, c) => (c === '%' ? '%' : ''));
    })
    .filter((arg) => arg !== null);
}
