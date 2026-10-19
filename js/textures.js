// Texturas generadas por código: portadas genéricas, contraportada, surcos del vinilo, madera, brillo.
const FONT = '"Samsung One", "Segoe UI", system-ui, Roboto, sans-serif';

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function wrapLines(g, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

let noise = null;
function noiseTile() {
  if (noise) return noise;
  noise = canvas(256);
  const g = noise.getContext('2d');
  const d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return noise;
}

/** Portada cuadrada 1024px: imagen del usuario (recorte centrado) o diseño genérico. */
export function makeCover(album, img) {
  const N = 1024, c = canvas(N), g = c.getContext('2d');
  if (img) {
    const s = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N);
    return c;
  }
  const p = album.palette || { bg: ['#333', '#111'], fg: '#fff', accent: '#a970ff', style: 'minimal' };
  const r = rng(album.id || album.title);
  const grd = g.createLinearGradient(0, 0, N, N);
  grd.addColorStop(0, p.bg[0]); grd.addColorStop(1, p.bg[1]);
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  g.strokeStyle = p.accent; g.fillStyle = p.accent;

  switch (p.style) {
    case 'circle':
      g.globalAlpha = 0.9; g.beginPath(); g.arc(N * 0.62, N * 0.42, N * 0.26, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.35; g.lineWidth = 6; g.beginPath(); g.arc(N * 0.62, N * 0.42, N * 0.34, 0, Math.PI * 2); g.stroke();
      break;
    case 'stripes':
      g.globalAlpha = 0.85;
      for (let i = 0; i < 7; i++) g.fillRect(N * 0.12 + i * N * 0.11, N * 0.18, N * 0.035, N * 0.5);
      break;
    case 'grid':
      g.globalAlpha = 0.5; g.lineWidth = 3;
      for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * N / 8, 0); g.lineTo(i * N / 8, N); g.stroke(); g.beginPath(); g.moveTo(0, i * N / 8); g.lineTo(N, i * N / 8); g.stroke(); }
      g.globalAlpha = 0.9; g.lineWidth = 10; g.beginPath(); g.arc(N / 2, N * 0.42, N * 0.2, 0, Math.PI * 2); g.stroke();
      break;
    case 'dots':
      for (let i = 0; i < 70; i++) { g.globalAlpha = 0.25 + r() * 0.6; g.beginPath(); g.arc(r() * N, r() * N * 0.7, 6 + r() * 26, 0, Math.PI * 2); g.fill(); }
      break;
    case 'flower': {
      g.globalAlpha = 0.75; const cx = N / 2, cy = N * 0.42;
      for (let i = 0; i < 8; i++) { g.save(); g.translate(cx, cy); g.rotate(i * Math.PI / 4); g.beginPath(); g.ellipse(0, -N * 0.13, N * 0.06, N * 0.13, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.globalAlpha = 1; g.fillStyle = p.fg; g.beginPath(); g.arc(cx, cy, N * 0.04, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'frame':
      g.globalAlpha = 0.9; g.lineWidth = 14; g.strokeRect(N * 0.1, N * 0.1, N * 0.8, N * 0.8);
      g.fillRect(N * 0.1, N * 0.62, N * 0.8, N * 0.02);
      break;
    case 'grain':
      for (let i = 0; i < 9000; i++) { g.globalAlpha = r() * 0.25; g.fillRect(r() * N, r() * N, 2, 2); }
      g.globalAlpha = 0.9; g.fillRect(N * 0.1, N * 0.45, N * 0.8, N * 0.012);
      break;
    case 'wings': {
      g.globalAlpha = 0.8; g.lineWidth = 4; const cx = N / 2, cy = N * 0.4;
      for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
        g.beginPath(); g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + side * N * (0.1 + i * 0.03), cy - N * (0.25 - i * 0.02), cx + side * N * (0.18 + i * 0.03), cy + N * (i * 0.025 - 0.05));
        g.stroke();
      }
      break;
    }
    default: // minimal
      g.globalAlpha = 0.6; g.lineWidth = 4; g.beginPath(); g.moveTo(N * 0.1, N * 0.66); g.lineTo(N * 0.9, N * 0.66); g.stroke();
  }
  g.globalAlpha = 1;

  // ruido sutil para que no parezca plano
  g.globalAlpha = 0.07;
  g.fillStyle = g.createPattern(noiseTile(), 'repeat');
  g.fillRect(0, 0, N, N);
  g.globalAlpha = 1;

  g.fillStyle = p.fg;
  g.textBaseline = 'alphabetic';
  g.font = `800 64px ${FONT}`;
  g.fillText('BTS', N * 0.08, N * 0.13);
  g.font = `700 74px ${FONT}`;
  const lines = wrapLines(g, album.title, N * 0.84).slice(0, 4);
  let y = N * 0.92 - (lines.length - 1) * 82;
  for (const l of lines) { g.fillText(l, N * 0.08, y); y += 82; }
  if (album.year) { g.globalAlpha = 0.7; g.font = `500 36px ${FONT}`; g.textAlign = 'right'; g.fillText(String(album.year), N * 0.92, N * 0.13); }
  return c;
}

export function averageColor(src) {
  const c = canvas(1), g = c.getContext('2d');
  g.drawImage(src, 0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${gg},${b})`;
}

export function luminance(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex) || [0, '11', '11', '11'];
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const fmt = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Contraportada con la lista de canciones. */
export function makeBack(album, cover) {
  const N = 512, c = canvas(N), g = c.getContext('2d');
  g.drawImage(cover, 0, 0, N, N);
  g.fillStyle = 'rgba(8,6,12,0.82)'; g.fillRect(0, 0, N, N);
  g.fillStyle = '#fff'; g.font = `700 30px ${FONT}`;
  g.fillText(String(album.title).slice(0, 30), 36, 62);
  g.globalAlpha = 0.6; g.font = `500 18px ${FONT}`;
  g.fillText(`${album.artist || 'BTS'}${album.year ? ' · ' + album.year : ''}`, 36, 90);
  g.globalAlpha = 1;
  const tr = album.tracks || [];
  g.font = `400 17px ${FONT}`;
  const max = 15;
  tr.slice(0, max).forEach((t, i) => {
    g.globalAlpha = 0.9; g.fillText(`${String(i + 1).padStart(2, '0')}  ${t.title.slice(0, 34)}`, 36, 132 + i * 23);
    g.globalAlpha = 0.5; g.textAlign = 'right'; g.fillText(fmt(t.duration), N - 36, 132 + i * 23); g.textAlign = 'left';
  });
  if (tr.length > max) { g.globalAlpha = 0.5; g.fillText(`+ ${tr.length - max} más`, 36, 132 + max * 23); }
  if (!tr.length) { g.globalAlpha = 0.5; g.fillText('Sin canciones todavía', 36, 140); }
  g.globalAlpha = 0.8;
  for (let i = 0; i < 40; i++) g.fillRect(N - 150 + i * 3, N - 70, (i * 7) % 3 + 1, 36);
  return c;
}

/**
 * Cara del vinilo (2048px). Las fracciones de radio coinciden con el recorrido del brazo,
 * así los espacios entre canciones quedan donde cae la aguja.
 */
export function makeVinyl(album, cover, { rStart = 0.945, rEnd = 0.44, rLabel = 0.335 } = {}) {
  const N = 2048, C = N / 2, R = N / 2;
  const c = canvas(N), g = c.getContext('2d');
  const col = album.vinyl || '#121212';
  const lum = luminance(col);
  const r = rng((album.id || '') + col);

  g.fillStyle = col;
  g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();

  // surcos
  const hi = lum < 0.5 ? 0.09 : 0.18;
  const lo = lum < 0.5 ? 0.35 : 0.12;
  g.lineWidth = 0.9;
  for (let rr = rEnd * R; rr < rStart * R; rr += 1.3) {
    const a = 0.25 + r() * 0.75;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${hi * a})` : `rgba(0,0,0,${lo * a})`;
    g.beginPath(); g.arc(C, C, rr, 0, Math.PI * 2); g.stroke();
  }
  // espacios entre canciones (bandas lisas)
  const tracks = album.tracks || [];
  const d = tracks.map((t) => (t.file !== false ? t.duration : t.full || t.duration) || 200);
  const tot = d.reduce((a, b) => a + b, 0);
  let acc = 0;
  g.strokeStyle = col; g.lineWidth = 7;
  for (let i = 0; i < d.length - 1; i++) {
    acc += d[i];
    const rr = (rStart - (acc / tot) * (rStart - rEnd)) * R;
    g.beginPath(); g.arc(C, C, rr, 0, Math.PI * 2); g.stroke();
    g.save(); g.lineWidth = 1.5; g.strokeStyle = `rgba(255,255,255,${hi * 1.4})`;
    g.beginPath(); g.arc(C, C, rr + 3.5, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  // borde liso exterior
  g.lineWidth = (1 - rStart) * R;
  g.strokeStyle = col;
  g.beginPath(); g.arc(C, C, R - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.beginPath(); g.arc(C, C, R - 2, 0, Math.PI * 2); g.stroke();
  // zona de salida con un par de surcos anchos
  g.lineWidth = 2; g.strokeStyle = `rgba(0,0,0,${lo})`;
  for (const f of [0.4, 0.37]) { g.beginPath(); g.arc(C, C, f * R, 0, Math.PI * 2); g.stroke(); }

  // etiqueta central con la portada
  const lr = rLabel * R;
  g.save();
  g.beginPath(); g.arc(C, C, lr, 0, Math.PI * 2); g.clip();
  g.drawImage(cover, C - lr, C - lr, lr * 2, lr * 2);
  const vg = g.createRadialGradient(C, C, lr * 0.6, C, C, lr);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(C - lr, C - lr, lr * 2, lr * 2);
  g.restore();
  g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.arc(C, C, lr, 0, Math.PI * 2); g.stroke();
  // agujero
  g.fillStyle = '#050505';
  g.beginPath(); g.arc(C, C, R * 0.02, 0, Math.PI * 2); g.fill();
  return c;
}

/** Reflejo fijo en forma de abanico, como la luz sobre un vinilo real. */
export function makeSheen() {
  const N = 1024, C = N / 2, c = canvas(N), g = c.getContext('2d');
  const cg = g.createConicGradient(-Math.PI * 0.78, C, C);
  const w = 'rgba(255,255,255,';
  cg.addColorStop(0.0, w + '0)');
  cg.addColorStop(0.05, w + '0.55)');
  cg.addColorStop(0.08, w + '0.75)');
  cg.addColorStop(0.13, w + '0)');
  cg.addColorStop(0.5, w + '0)');
  cg.addColorStop(0.55, w + '0.45)');
  cg.addColorStop(0.58, w + '0.6)');
  cg.addColorStop(0.63, w + '0)');
  cg.addColorStop(1, w + '0)');
  g.fillStyle = cg; g.fillRect(0, 0, N, N);
  // más fuerte hacia el borde
  g.globalCompositeOperation = 'destination-in';
  const rg = g.createRadialGradient(C, C, 0, C, C, C);
  rg.addColorStop(0.3, 'rgba(0,0,0,0.25)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = rg; g.fillRect(0, 0, N, N);
  return c;
}

/** Lateral del plato con puntos estroboscópicos. */
export function makeStrobe() {
  const W = 2048, H = 64, c = canvas(W, H), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#f4eef1'); grd.addColorStop(0.5, '#d9cfd4'); grd.addColorStop(1, '#efe8ec');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f0699a';
  const n = 180;
  for (let i = 0; i < n; i++) { g.fillRect(i * W / n + 2, H * 0.3, W / n * 0.45, H * 0.16); g.fillRect(i * W / n + 2, H * 0.58, W / n * 0.45, H * 0.12); }
  return c;
}

export function makePlate(text) {
  const W = 512, H = 112, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#fff6f9'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f0699a'; g.font = `300 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '10px';
  g.fillText(text, W / 2, H / 2 + 2);
  return c;
}
