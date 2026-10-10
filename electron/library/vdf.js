// Analizador del formato de texto VDF/KeyValues de Valve
// (libraryfolders.vdf, appmanifest_*.acf). Devuelve objetos anidados con las
// claves en minúsculas, porque Steam no es consistente con las mayúsculas.
export function parseVdf(text) {
  let i = 0;

  function skip() {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (text[i] === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++;
      } else {
        return;
      }
    }
  }

  function string() {
    i++; // comilla inicial
    let out = '';
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < text.length) {
        const next = text[i + 1];
        out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
        i += 2;
      } else {
        out += text[i++];
      }
    }
    i++; // comilla final
    return out;
  }

  function object() {
    const obj = {};
    for (;;) {
      skip();
      if (i >= text.length || text[i] === '}') {
        i++;
        return obj;
      }
      if (text[i] !== '"') throw new Error(`VDF no válido en la posición ${i}`);
      const key = string().toLowerCase();
      skip();
      if (text[i] === '{') {
        i++;
        obj[key] = object();
      } else if (text[i] === '"') {
        obj[key] = string();
      } else {
        throw new Error(`VDF no válido en la posición ${i}`);
      }
    }
  }

  return object();
}
