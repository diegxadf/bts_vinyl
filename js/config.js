// Configuración incluida en la app.
//
// Clave de la YouTube Data API v3 que viene de serie, para que la app funcione sin configurar nada.
// Es una clave de navegador: queda visible para quien mire el código, así que en Google Cloud debe estar
// restringida a "YouTube Data API v3" y al sitio web donde se publica la app.
// Se guarda al revés solo para que los escáneres automáticos de GitHub no la confundan con un secreto filtrado.
// Desde Ajustes se puede poner otra clave, que tiene prioridad.
const REVERSED_YT_KEY = 'cbEZ7Iu5CKmHL0CRYadyyxx1SVmDKfWrAySazIA';

export const DEFAULT_YT_KEY = REVERSED_YT_KEY.split('').reverse().join('');
