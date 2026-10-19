// Editor de álbum: título, año, portada, color del vinilo y canciones.
import * as db from './db.js';
import { VINYL_COLORS } from './albums.js';
import { makeCover } from './textures.js';
import * as catalog from './catalog.js';

const $ = (s) => document.querySelector(s);
const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const fmt = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function cleanTitle(name) {
  const t = name
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ')
    .replace(/^\s*(?:disc\s*\d+\s*[-.]?\s*)?\d{1,3}\s*[-.)]*\s+/i, '')
    .replace(/^BTS\s*(\([^)]*\))?\s*[-–]\s*/i, '')
    .trim();
  return t || name;
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    let settled = false;
    const fin = (d) => { if (settled) return; settled = true; URL.revokeObjectURL(url); resolve(d); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => fin(0);
    setTimeout(() => fin(0), 8000);
    a.src = url;
  });
}

let state = null;

export async function openEditor(album, { isNew = false, onSave, onDelete, onCancel } = {}) {
  const draft = { ...album, tracks: album.tracks.map((t) => ({ ...t })) };
  state = { album, draft, isNew, onSave, onDelete, onCancel, added: [], coverImg: null };

  $('#ed-heading').textContent = isNew ? 'Nuevo álbum' : 'Editar álbum';
  $('#ed-title').value = draft.title || '';
  $('#ed-artist').value = draft.artist || 'BTS';
  $('#ed-year').value = draft.year || '';
  $('#ed-delete').style.visibility = isNew ? 'hidden' : 'visible';
  if (draft.cover) { try { state.coverImg = await createImageBitmap(draft.cover); } catch { state.coverImg = null; } }
  $('#ed-search').hidden = true;
  $('#ed-results').innerHTML = '';
  renderSwatches();
  renderCover();
  renderTracks();
  $('#editor').hidden = false;
  requestAnimationFrame(() => $('#editor').classList.add('open'));
}

function close() {
  const ed = $('#editor');
  ed.classList.remove('open');
  setTimeout(() => { if (!ed.classList.contains('open')) ed.hidden = true; }, 320);
  state = null;
}

function renderCover() {
  const c = $('#ed-cover-preview'), g = c.getContext('2d');
  const d = state.draft;
  g.drawImage(makeCover({ ...d, title: $('#ed-title').value || d.title, year: $('#ed-year').value }, state.coverImg), 0, 0, c.width, c.height);
}

function renderSwatches() {
  const box = $('#ed-swatches');
  box.innerHTML = '';
  for (const v of VINYL_COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch' + (state.draft.vinyl === v.value ? ' sel' : '');
    b.style.background = `radial-gradient(circle, ${v.value} 0 55%, ${v.value} 56%), ${v.value}`;
    b.title = v.name;
    b.onclick = () => { state.draft.vinyl = v.value; renderSwatches(); };
    box.appendChild(b);
  }
}

function renderTracks(msg) {
  const list = $('#ed-track-list');
  const tr = state.draft.tracks;
  list.innerHTML = '';
  tr.forEach((t, i) => {
    const li = document.createElement('li');
    const badge = t.file === false
      ? `<span class="badge ${t.previewUrl ? '' : 'off'}">${t.previewUrl ? 'catálogo' : 'YouTube'}</span>`
      : '<span class="badge own">archivo</span>';
    li.innerHTML = `<span class="n">${i + 1}</span><input value="">${badge}<span class="d">${fmt(t.full || t.duration)}</span>
      <button class="up" aria-label="Subir">${ICON_UP}</button><button class="down" aria-label="Bajar">${ICON_DOWN}</button><button class="rm" aria-label="Quitar">${ICON_X}</button>`;
    const inp = li.querySelector('input');
    inp.value = t.title;
    inp.oninput = () => { t.title = inp.value; };
    li.querySelector('.up').onclick = () => { if (i > 0) { [tr[i - 1], tr[i]] = [tr[i], tr[i - 1]]; renderTracks(); } };
    li.querySelector('.down').onclick = () => { if (i < tr.length - 1) { [tr[i + 1], tr[i]] = [tr[i], tr[i + 1]]; renderTracks(); } };
    li.querySelector('.rm').onclick = () => { tr.splice(i, 1); renderTracks(); };
    list.appendChild(li);
  });
  $('#ed-count').textContent = tr.length ? `· ${tr.length}` : '';
  const online = tr.filter((t) => t.file === false).length;
  $('#ed-hint').textContent = msg || (!tr.length
    ? 'Toca "Buscar en iTunes" para traer portada y canciones, escribe canciones "Por nombre", o añade tus propios archivos de audio (MP3, M4A, FLAC…).'
    : online
      ? `${online} ${online === 1 ? 'canción suena' : 'canciones suenan'} desde internet (YouTube, o el avance de 30 s si no se puede). Tus archivos con el mismo nombre ocupan su lugar y suenan sin conexión.`
      : 'Usa las flechas para reordenar; toca un título para renombrarlo.');
}

// ---------- búsqueda en iTunes ----------
async function runSearch(q) {
  const box = $('#ed-results');
  box.innerHTML = '<p class="hint">Buscando…</p>';
  try {
    const res = await catalog.searchAlbums(q);
    box.innerHTML = '';
    if (!res.length) { box.innerHTML = '<p class="hint">Sin resultados. Prueba con otro nombre.</p>'; return; }
    res.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'result';
      b.style.animationDelay = `${i * 25}ms`;
      b.innerHTML = '<img alt="" loading="lazy"><span class="rt"></span><span class="rm"></span>';
      b.querySelector('img').src = r.thumb;
      b.querySelector('.rt').textContent = r.title;
      b.querySelector('.rm').textContent = `${r.artist} · ${r.year} · ${r.count} canc.`;
      b.onclick = () => pickResult(r, b);
      box.appendChild(b);
    });
  } catch {
    box.innerHTML = '<p class="hint">No hay conexión con iTunes. Revisa el Wi-Fi e inténtalo de nuevo.</p>';
  }
}

async function pickResult(r, btn) {
  const s = state;
  btn.classList.add('loading');
  try {
    const [blob, tracks] = await Promise.all([catalog.fetchBlob(r.art), catalog.albumTracks(r.id)]);
    if (state !== s) return;
    s.draft.cover = blob;
    s.coverImg = await createImageBitmap(blob);
    if (!$('#ed-year').value && r.year) $('#ed-year').value = r.year;
    if (s.isNew) $('#ed-title').value = r.title.replace(/\s*-\s*(Single|EP)$/i, '');
    s.draft.tracks = catalog.mergeTracks(tracks, s.draft.tracks);
    s.draft.itunesId = r.id;
    $('#ed-search').hidden = true;
    renderCover();
    renderTracks();
  } catch {
    btn.classList.remove('loading');
    renderTracks('No se pudo descargar ese álbum. Inténtalo de nuevo.');
  }
}

$('#ed-search-btn').addEventListener('click', () => {
  const box = $('#ed-search');
  box.hidden = !box.hidden;
  if (!box.hidden) {
    const q = `BTS ${$('#ed-title').value}`.trim();
    $('#ed-search-q').value = q;
    runSearch(q);
  }
});
$('#ed-search-form').addEventListener('submit', (e) => { e.preventDefault(); runSearch($('#ed-search-q').value); });

async function addTracks(files) {
  const s = state;
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  for (let i = 0; i < sorted.length; i++) {
    if (state !== s) return;
    const f = sorted[i];
    renderTracks(`Importando ${i + 1} de ${sorted.length}: ${f.name}`);
    const duration = await probeDuration(f);
    const id = db.uid();
    try {
      await db.put('tracks', { id, albumId: s.draft.id, blob: f, name: f.name, type: f.type });
    } catch (e) {
      renderTracks('No se pudo guardar "' + f.name + '" (¿sin espacio?).');
      return;
    }
    s.added.push(id);
    catalog.placeFile(s.draft.tracks, { id, title: cleanTitle(f.name), duration, file: true });
  }
  renderTracks();
}

// canción escrita a mano: suena desde YouTube buscando por su nombre
$('#ed-add-name').addEventListener('click', () => {
  if (!state) return;
  state.draft.tracks.push({ id: 'name-' + db.uid(), title: '', file: false, previewUrl: null, duration: 210 });
  renderTracks();
  const inputs = document.querySelectorAll('#ed-track-list input');
  const last = inputs[inputs.length - 1];
  last.placeholder = 'Nombre de la canción';
  last.focus();
  last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

$('#ed-title').addEventListener('input', () => state && renderCover());
$('#ed-year').addEventListener('input', () => state && renderCover());
$('#ed-cover-input').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !state) return;
  try {
    state.coverImg = await createImageBitmap(f);
    state.draft.cover = f;
    renderCover();
  } catch { alert('No se pudo leer esa imagen.'); }
});
$('#ed-cover-reset').addEventListener('click', () => { if (!state) return; state.draft.cover = null; state.coverImg = null; renderCover(); });
$('#ed-track-input').addEventListener('change', (e) => {
  const files = e.target.files;
  if (files?.length && state) addTracks(files).finally(() => { e.target.value = ''; });
});

async function cancel() {
  if (!state) return;
  const { added, onCancel } = state;
  close();
  await db.delMany('tracks', added).catch(() => {});
  onCancel?.();
}
$('#ed-cancel').addEventListener('click', cancel);
$('#ed-close').addEventListener('click', cancel);

$('#ed-save').addEventListener('click', async () => {
  if (!state) return;
  const { album, draft, onSave, isNew } = state;
  draft.title = $('#ed-title').value.trim() || 'Sin título';
  draft.artist = $('#ed-artist').value.trim() || 'BTS';
  const y = parseInt($('#ed-year').value, 10);
  draft.year = Number.isFinite(y) ? y : '';
  draft.tracks = draft.tracks.filter((t) => t.file !== false || t.title.trim());
  const keep = new Set(draft.tracks.map((t) => t.id));
  const removed = album.tracks.filter((t) => !keep.has(t.id)).map((t) => t.id);
  const orphanAdded = state.added.filter((id) => !keep.has(id));
  close();
  await db.delMany('tracks', [...removed, ...orphanAdded]).catch(() => {});
  onSave?.(draft, { isNew });
});

$('#ed-delete').addEventListener('click', async () => {
  if (!state) return;
  if (!confirm(`¿Eliminar "${state.album.title}" y sus canciones de la tablet?`)) return;
  const { album, added, onDelete } = state;
  close();
  await db.delMany('tracks', [...album.tracks.map((t) => t.id), ...added]).catch(() => {});
  onDelete?.(album);
});
