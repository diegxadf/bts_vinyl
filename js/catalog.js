// Catálogo público de iTunes / Apple Music: portadas, listas de canciones y avances de 30 s.
// No necesita cuenta ni clave. https://performance-partners.apple.com/search-api
import { EXTRAS, EXTRAS_VERSION } from './extras.js';

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
/** Variantes de un mismo disco (Voice Memo, remixes, "+1db", versiones de colores…). */
export const isVariant = (a) => /voice memo|remix|\(\+\d+\s*db\)|\b(wonder|wander|weekday|weekend) ver|hope edition/i.test(a.title);

// Discografías en solitario (ids de artista de iTunes). SUGA publica como Agust D.
export const MEMBERS = [
  { name: 'RM', id: 1439549457 },
  { name: 'Jin', id: 1191850724 },
  { name: 'SUGA', id: 1633387333 },
  { name: 'j-hope', id: 1354883995 },
  { name: 'Jimin', id: 1620160561 },
  { name: 'V', id: 1191852113 },
  { name: 'Jung Kook', id: 785052275 },
];
let soloCache = null;
/** Álbumes y EP de los siete miembros, de lo más nuevo a lo más antiguo. */
export async function soloAlbums() {
  if (!soloCache) {
    const lists = await Promise.all(MEMBERS.map(async (m) => {
      const d = await getJSON(`${BASE}/lookup?id=${m.id}&entity=album&limit=200&country=${COUNTRY}`);
      return d.results
        .filter((x) => x.wrapperType === 'collection' && x.trackCount >= 5 && x.artistId === m.id)
        .map((x) => ({ ...mapAlbum(x), date: x.releaseDate || '', member: m.name }));
    }));
    soloCache = lists.flat().sort((a, b) => b.date.localeCompare(a.date));
  }
  return soloCache;
}

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
  const d = await getJSON(`${BASE}/lookup?id=${collectionId}&entity=song&limit=200&country=${COUNTRY}`);
  return d.results
    .filter((x) => x.wrapperType === 'track' && x.kind === 'song')
    .sort((a, b) => (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber))
    .map((x) => ({
      disc: x.discNumber,
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
const YT_FIELDS = ['yt', 'ytAlt', 'ytBad', 'ytBlocked'];
export function mergeTracks(catalog, existing) {
  const own = existing.filter((t) => t.file !== false);
  const prev = new Map(existing.map((t) => [t.id, t]));
  const used = new Set();
  const out = catalog.map((c) => {
    const m = own.find((t) => !used.has(t.id) && norm(t.title) === norm(c.title));
    if (!m) {
      // conserva el video de YouTube ya encontrado para esa misma canción
      const p = prev.get(c.id);
      return p ? { ...c, ...Object.fromEntries(YT_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) } : c;
    }
    used.add(m.id);
    return { ...m, title: c.title, full: c.full };
  });
  return [...out, ...own.filter((t) => !used.has(t.id))];
}

// ============================================================
// Canciones de las ediciones físicas (lista verificada en extras.js).
// ============================================================
/** Añade las canciones físicas que falten a un álbum. Devuelve cuántas añadió. */
export function applyExtras(album) {
  if (album.extrasV >= EXTRAS_VERSION) return 0;
  const entry = EXTRAS.find((e) => releaseKey(e.album) === releaseKey(album.title));
  album.extrasV = EXTRAS_VERSION;
  if (!entry) return 0;
  const key = releaseKey(album.title);
  // nombre exacto: "I NEED U (Demo Ver.)" no es la misma canción que "I NEED U"
  const indexOf = (title) => (title ? album.tracks.findIndex((t) => releaseKey(t.title) === releaseKey(title)) : -1);
  let prev = entry.after;
  let added = 0;
  entry.tracks.forEach(([title, len], i) => {
    if (indexOf(title) >= 0) { prev = title; return; }
    const p = indexOf(prev);
    const at = p < 0 ? album.tracks.length : p + 1; // justo después de la anterior del CD
    album.tracks.splice(at, 0, { id: `x-${key}-${i}`, title, file: false, previewUrl: null, duration: len, full: len, physical: true });
    prev = title;
    added++;
  });
  return added;
}

/** Coloca un archivo propio en el hueco del avance con el mismo título, si existe. */
export function placeFile(tracks, fileTrack) {
  const i = tracks.findIndex((t) => t.file === false && norm(t.title) === norm(fileTrack.title));
  if (i < 0) { tracks.push(fileTrack); return false; }
  tracks[i] = { ...fileTrack, title: tracks[i].title, full: tracks[i].full };
  return true;
}
