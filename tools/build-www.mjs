// Copia la app web a www/, que es lo que Capacitor mete dentro de las apps de Android e iOS.
// Uso: npm run build
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const files = ['index.html', 'manifest.webmanifest', 'sw.js'];
const dirs = ['css', 'js', 'vendor', 'icons'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of files) cpSync(join(root, f), join(out, f));
for (const d of dirs) cpSync(join(root, d), join(out, d), { recursive: true });
console.log('www/ listo');
