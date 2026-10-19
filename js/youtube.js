// Canciones completas desde YouTube: búsqueda (YouTube Data API v3) y reproductor oficial incrustado (IFrame API).
// Las normas de YouTube piden que el reproductor esté visible (mínimo 200×200 px): se muestra en el panel.
import { norm } from './catalog.js';

const API = 'https://www.googleapis.com/youtube/v3';

export class YouTubeError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function api(path, key) {
  let r;
  try { r = await fetch(`${API}/${path}&key=${encodeURIComponent(key)}`); }
  catch { throw new YouTubeError('offline', 'Sin conexión con YouTube.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = j.error?.errors?.[0]?.reason || '';
    if (/quota/i.test(reason)) throw new YouTubeError('quota', 'Se agotó el cupo diario de búsquedas de YouTube (se renueva cada día).');
    if (/key|forbidden|accessNotConfigured/i.test(reason) || r.status === 400 || r.status === 403) {
      throw new YouTubeError('key', 'La clave de YouTube no es válida o la API no está activada.');
    }
    throw new YouTubeError('http', `YouTube respondió ${r.status}.`);
  }
  return j;
}

/** Comprueba la clave con una llamada barata (1 unidad de cupo). */
export async function testKey(key) {
  await api('videos?part=id&id=gdZLi9oWNZg', key);
  return true;
}

const decode = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
const BAD = /(reaction|cover|karaoke|instrumental|inst\.|sped ?up|slowed|8d|nightcore|remix|dance practice|easy lyrics|piano|lofi|fanmade|fmv|1 hour|teaser|making|live|concert|stage)/i;

function score(item, title) {
  const vt = decode(item.snippet.title);
  const ch = decode(item.snippet.channelTitle);
  let s = 0;
  if (/^BTS\s*-\s*Topic$/i.test(ch)) s += 6;
  else if (/HYBE LABELS|BANGTANTV|BTS/i.test(ch)) s += 3;
  if (norm(vt).includes(norm(title))) s += 3;
  const want = BAD.exec(title)?.[0];
  const has = BAD.exec(vt)?.[0];
  if (has && (!want || want.toLowerCase() !== has.toLowerCase())) s -= 5;
  return s;
}

/** Busca el video de una canción (100 unidades de cupo por búsqueda). Prefiere el canal oficial "BTS - Topic". */
export async function findVideo(key, { title, album, artist = 'BTS' }) {
  const queries = [`${artist} ${title} ${album}`, `${artist} ${title}`];
  let best = null;
  for (const q of queries) {
    const j = await api(`search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(q)}`, key);
    for (const it of j.items || []) {
      const s = score(it, title);
      if (!best || s > best.s) best = { id: it.id.videoId, s };
    }
    if (best && best.s >= 6) break;
  }
  return best && best.s >= 2 ? best.id : null;
}

// ---------- reproductor ----------
let apiReady = null;
function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiReady) {
    apiReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiReady = null; reject(new YouTubeError('offline', 'No se pudo cargar YouTube.')); };
      document.head.appendChild(s);
    });
  }
  return apiReady;
}

/**
 * Envoltorio con la misma forma que un <audio>: play(), pause(), currentTime, duration, volume, ended
 * y eventos 'ended', 'pause', 'playing', 'error'.
 */
export class YouTubeMedia extends EventTarget {
  constructor(el) {
    super();
    this.el = el;
    this.player = null;
    this.ready = null;
    this.videoId = null;
    this.started = false;
    this.startAt = 0;
    this.ended = false;
    this._volume = 1;
    this.internalPause = 0;
  }

  _ensure() {
    if (!this.ready) {
      this.ready = loadIframeApi().then(() => new Promise((resolve) => {
        this.player = new window.YT.Player(this.el, {
          width: '100%', height: '100%',
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, iv_load_policy: 3, fs: 0, modestbranding: 1, origin: location.origin },
          events: {
            onReady: () => { this.player.setVolume(Math.round(this._volume * 100)); resolve(); },
            onStateChange: (e) => this._state(e.data),
            onError: (e) => this.dispatchEvent(new CustomEvent('error', { detail: e.data })),
          },
        });
      }));
      this.ready.catch(() => { this.ready = null; });
    }
    return this.ready;
  }

  _state(s) {
    const S = window.YT.PlayerState;
    if (s === S.PLAYING) { this.started = true; this.dispatchEvent(new Event('playing')); }
    else if (s === S.ENDED) { this.ended = true; this.dispatchEvent(new Event('ended')); }
    else if (s === S.PAUSED && performance.now() - this.internalPause > 800) this.dispatchEvent(new Event('pause'));
  }

  /** Prepara el video sin empezar a sonar (muestra su miniatura). */
  async load(videoId) {
    await this._ensure();
    this.videoId = videoId;
    this.started = false;
    this.ended = false;
    this.startAt = 0;
    this.player.cueVideoById(videoId);
  }

  async play() {
    await this._ensure();
    if (!this.videoId) return;
    if (!this.started) this.player.loadVideoById({ videoId: this.videoId, startSeconds: this.startAt });
    else this.player.playVideo();
  }

  pause() {
    if (!this.player?.pauseVideo) return;
    this.internalPause = performance.now();
    this.player.pauseVideo();
  }

  stop() {
    this.pause();
    this.videoId = null;
    this.started = false;
  }

  get currentTime() { return this.started ? this.player.getCurrentTime() || 0 : this.startAt; }
  set currentTime(t) {
    if (this.started) this.player.seekTo(t, true);
    else this.startAt = t;
  }
  get duration() { return this.player?.getDuration?.() || NaN; }
  get volume() { return this._volume; }
  set volume(v) { this._volume = v; this.player?.setVolume?.(Math.round(v * 100)); }
}
