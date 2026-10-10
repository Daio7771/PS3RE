// Se carga en <head>, antes del primer pintado: en la app de escritorio
// (preload ya ha expuesto window.launcher) no hay pantalla de encendido.
// Es un archivo aparte, y no un script en línea, por la política de contenido.
if (window.launcher) document.documentElement.classList.add('in-app');
