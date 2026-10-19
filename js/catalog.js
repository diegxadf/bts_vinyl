// Catálogo público de iTunes / Apple Music: portadas, listas de canciones y avances de 30 s.
// No necesita cuenta ni clave. https://performance-partners.apple.com/search-api
const BASE = 'https://itunes.apple.com';
const COUNTRY = 'us';
const BTS_ID = 883131348;

/** Nombre exacto de un lanzamiento: distingue ediciones, p. ej. "(Special Edition)". */
export const releaseKey = (s) => String(s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\s*[-–]\s*(single|ep)\s*$/i, '')
  .replace(/[^\p{L}\p{N}]/gu, '');

/** Nombre flexible: ignora la edición. Sirve para emparejar títulos y canciones. */
export const norm = (s) => releaseKey(String(s || '').replace(/\((?:[^)]*?)(edition|ver\.?|version)\)/gi, ''));

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export const artwork = (url, size = 1200) => url.replace(/\/\d+x\d+bb\.(jpg|png)$/i, `/${size}x${size}bb.jpg`);

function mapAlbum(x) {
  return {
    id: x.collectionId,
    title: x.collectionName,
    artist: x.artistName,
    year: (x.releaseDate || '').slice(0, 4),
    count: x.trackCount,
    thumb: artwork(x.artworkUrl100, 300),
    art: artwork(x.artworkUrl100, 1200),
  };
}

export async function searchAlbums(term) {
  const d = await getJSON(`${BASE}/search?term=${encodeURIComponent(term)}&entity=album&limit=30&country=${COUNTRY}`);
  return d.results.filter((x) => x.wrapperType === 'collection').map(mapAlbum);
}

let btsCache = null;
/** Toda la discografía de BTS en iTunes, de lo más nuevo a lo más antiguo. */
export async function btsAlbums() {
  if (!btsCache) {
    const d = await getJSON(`${BASE}/lookup?id=${BTS_ID}&entity=album&limit=200&country=${COUNTRY}`);
    btsCache = d.results
      .filter((x) => x.wrapperType === 'collection')
      .map((x) => ({ ...mapAlbum(x), date: x.releaseDate || '' }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  return btsCache;
}

export const isSingle = (a) => /\s-\s(Single|EP)$/i.test(a.title) || a.count < 5;

/** Ediciones de la discografía de BTS con el mismo nombre, de la más probable a la menos. */
export async function matchBtsAll(title, hint) {
  const n = norm(title);
  const exact = (await btsAlbums())
    .filter((a) => norm(a.title) === n)
    .sort((a, b) => (b.id === hint) - (a.id === hint) || a.title.length - b.title.length || b.count - a.count);
  if (exact.length) return exact;
  const found = await searchAlbums(`BTS ${title}`);
  return found.filter((a) => /bts/i.test(a.artist) && norm(a.title).includes(n));
}

/** Portada y canciones de la primera edición que tenga lista de canciones disponible. */
export async function fetchAlbum(candidates) {
  for (const c of candidates.slice(0, 4)) {
    const tracks = await albumTracks(c.id);
    if (!tracks.length) continue;
    return { match: c, tracks, cover: await fetchBlob(c.art) };
  }
  return null;
}

export async function albumTracks(collectionId) {
  const d = await getJSON(`${BASE}/lookup?id=${collectionId}&entity=song&country=${COUNTRY}`);
  return d.results
    .filter((x) => x.wrapperType === 'track' && x.kind === 'song')
    .sort((a, b) => (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber))
    .map((x) => ({
      id: 'it-' + x.trackId,
      title: x.trackName,
      file: false,
      previewUrl: x.previewUrl || null,
      duration: 30,
      full: Math.round((x.trackTimeMillis || 0) / 1000),
    }));
}

export async function fetchBlob(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.blob();
}

/**
 * Une la lista oficial con las canciones que ya tienes en la tablet:
 * si un archivo propio tiene el mismo título, ocupa ese lugar (y suena completo).
 */
export function mergeTracks(catalog, existing) {
  const own = existing.filter((t) => t.file !== false);
  const used = new Set();
  const out = catalog.map((c) => {
    const m = own.find((t) => !used.has(t.id) && norm(t.title) === norm(c.title));
    if (!m) return c;
    used.add(m.id);
    return { ...m, title: c.title, full: c.full };
  });
  return [...out, ...own.filter((t) => !used.has(t.id))];
}

/** Coloca un archivo propio en el hueco del avance con el mismo título, si existe. */
export function placeFile(tracks, fileTrack) {
  const i = tracks.findIndex((t) => t.file === false && norm(t.title) === norm(fileTrack.title));
  if (i < 0) { tracks.push(fileTrack); return false; }
  tracks[i] = { ...fileTrack, title: tracks[i].title, full: tracks[i].full };
  return true;
}
