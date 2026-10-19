# BTS Vinyl — tocadiscos virtual 3D

App web instalable (PWA) pensada para la Galaxy Tab S9 Ultra. Funciona sin internet una vez instalada.
Tus portadas y canciones se guardan **dentro de la tablet** (en el almacenamiento del navegador), no se suben a ningún sitio.

## Cómo se usa
- **Biblioteca:** desliza a los lados para ver las fundas en 3D. Toca la funda del centro (o "Poner disco").
- **Tocadiscos:** la funda vuela a la mesa, el vinilo sale y cae en el plato, y el brazo baja solo.
  - Arrastra el **brazo** sobre el disco para saltar a otra parte (los espacios lisos entre surcos son los cortes entre canciones).
  - Lleva el brazo a su soporte, o toca el **botón plateado** del tocadiscos, para pararlo.
  - Toca la funda que está sobre la mesa para volver a la biblioteca.
- **Editar:** cambia la portada (sube la imagen real del álbum), el color del vinilo, el título, y añade canciones
  (MP3, M4A, FLAC, OGG… que tengas en la tablet). Puedes reordenarlas y renombrarlas.
- **+ Álbum:** crea álbumes nuevos (repackages, singles, discos en solitario…).

## Portadas y canciones
- **Portadas:** la primera vez que abres la app (con internet) descarga sola las portadas reales y las listas de
  canciones desde el catálogo público de iTunes/Apple Music. El botón **Portadas** lo repite para álbumes nuevos.
  En **Editar → Buscar en iTunes** puedes elegir otra edición o buscar cualquier álbum.
- **Completas desde YouTube:** en **Ajustes** (icono de deslizadores) pega una clave gratuita de la
  YouTube Data API v3 (los pasos están en la propia pantalla). Cada canción se busca una vez en el canal oficial
  "BTS - Topic" y queda guardada; el video se ve en el panel (YouTube exige que esté visible). Cupo gratuito:
  unas 100 canciones nuevas al día. Necesita internet y no suena con la pantalla apagada.
- **Avances de 30 s:** si no hay clave o falla YouTube, cada canción suena como avance de iTunes.
- **Canciones completas:** en **Editar → + Añadir canciones** elige tus archivos (MP3/M4A/FLAC…). Si el nombre
  coincide con una canción de la lista, ocupa su lugar y suena entera, también sin conexión.
  Sirven compras sin DRM (iTunes Store, Amazon Music en MP3, Qobuz, 7digital…). Las descargas de Spotify o
  Apple Music están protegidas y no se pueden usar.

## Probar en la tablet desde el PC (misma Wi-Fi)
```
node tools/serve.mjs
```
Abre en Chrome de la tablet la dirección "Desde la tablet: http://192.168.x.x:8080" que aparece.
Así la app no queda instalada sin conexión: para eso hace falta HTTPS (ver abajo).

## Instalarla de verdad (sin conexión, icono en la pantalla de inicio)
Sube esta carpeta a un hosting estático con HTTPS (GitHub Pages, Netlify, Cloudflare Pages…),
ábrela en Chrome de la tablet → menú ⋮ → **Instalar app** / **Añadir a pantalla de inicio**.
Se abre a pantalla completa y funciona sin internet.

## Archivos
- `index.html`, `css/style.css` — interfaz
- `js/main.js` — escena 3D (carrusel, tocadiscos, brazo) y reproducción
- `js/textures.js` — portadas genéricas, surcos del vinilo, madera
- `js/editor.js` — editor de álbumes · `js/db.js` — almacenamiento local · `js/sfx.js` — crujido y sonidos de aguja
- `js/albums.js` — discografía inicial y colores de vinilo
- `vendor/` — Three.js r160 · `sw.js`, `manifest.webmanifest`, `icons/` — instalación como app
- `tools/make-icons.mjs` regenera los iconos · `tools/serve.mjs` servidor local
