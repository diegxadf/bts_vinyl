// Genera los iconos PNG de la app (un vinilo con etiqueta morada). Uso: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function shade(nx, ny, scale, maskable) {
  // nx, ny en [-1, 1]; maskable: false (transparente) | true (fondo rosado) | 'flat' (fondo liso, pantalla de inicio)
  const r = Math.hypot(nx, ny) / scale;
  const bgT = (ny + 1) / 2;
  const bg = maskable === 'flat' ? [252, 247, 249, 255]
    : maskable ? [lerp(253, 246, bgT), lerp(242, 205, bgT), lerp(247, 222, bgT), 255] : [0, 0, 0, 0];
  if (r > 0.92) return bg;
  if (r < 0.04) return bg[3] ? bg : [252, 247, 249, 255];
  if (r < 0.34) {
    // etiqueta rosa
    const t = r / 0.34;
    return [lerp(255, 240, t), lerp(170, 105, t), lerp(200, 154, t), 255];
  }
  const groove = 0.5 + 0.5 * Math.sin(r * 260);
  const ang = Math.atan2(ny, nx);
  const sheen = Math.max(0, Math.cos(2 * (ang + 0.8))) ** 6 * 70 * Math.min(1, (r - 0.34) * 3);
  const v = 18 + groove * 8 + sheen;
  return [v, v - 2, v + 6, 255];
}
const lerp = (a, b, t) => a + (b - a) * t;

function render(size, scale, maskable, ss = 3) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0, 0];
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const nx = ((x + (sx + 0.5) / ss) / size) * 2 - 1;
      const ny = ((y + (sy + 0.5) / ss) / size) * 2 - 1;
      const c = shade(nx, ny, scale, maskable);
      acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3];
    }
    const i = (y * size + x) * 4;
    const a = acc[3] / (ss * ss);
    px[i] = acc[3] ? acc[0] / acc[3] : 0;
    px[i + 1] = acc[3] ? acc[1] / acc[3] : 0;
    px[i + 2] = acc[3] ? acc[2] / acc[3] : 0;
    px[i + 3] = a;
  }
  return png(size, px);
}

writeFileSync(join(out, 'icon-192.png'), render(192, 1.0, false));
writeFileSync(join(out, 'icon-512.png'), render(512, 1.0, false));
writeFileSync(join(out, 'icon-maskable-512.png'), render(512, 0.72, true));
console.log('Iconos web generados en', out);

// Originales para las apps nativas (npx @capacitor/assets generate los convierte a todos los tamaños)
const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(assets, { recursive: true });
writeFileSync(join(assets, 'icon-only.png'), render(1024, 0.74, true, 2));        // App Store: sin transparencias
writeFileSync(join(assets, 'icon-foreground.png'), render(1024, 0.56, false, 2)); // Android adaptable: dentro de la zona segura
writeFileSync(join(assets, 'icon-background.png'), render(1024, 0.0001, true, 1));
writeFileSync(join(assets, 'splash.png'), render(2732, 0.16, 'flat', 1));
writeFileSync(join(assets, 'splash-dark.png'), render(2732, 0.16, 'flat', 1));
console.log('Originales nativos generados en', assets);
