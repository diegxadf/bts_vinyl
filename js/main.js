import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';
import * as db from './db.js';
import { DEFAULT_ALBUMS, newAlbumTemplate } from './albums.js';
import * as T from './textures.js';
import * as sfx from './sfx.js';
import { openEditor } from './editor.js';
import * as catalog from './catalog.js';
import { YouTubeMedia, findVideo, testKey, isBlockedError } from './youtube.js';
import { DEFAULT_YT_KEY } from './config.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Medidas del mundo (1 unidad ≈ 10 cm)
// ============================================================
const S = 3.1, ST = 0.05;                     // funda
const REC_R = 1.45, REC_H = 0.024;            // vinilo
const CAR_Z = -14, CAR_Y = S / 2 + 0.01;      // carrusel
const PEEK = 1.25;                            // cuánto asoma el disco de la funda
const TT = new THREE.Vector3(0.7, 0, 0);      // tocadiscos
const FEET = 0.1, PL_W = 4.7, PL_H = 0.42, PL_D = 3.7, TOP = FEET + PL_H;
const PLAT = new THREE.Vector3(-0.5, 0, 0.05); // centro del plato (local)
const PLAT_TOP = TOP + 0.04 + 0.13 + 0.012;
const REC_Y = PLAT_TOP + REC_H / 2;
const PIVOT = new THREE.Vector3(1.62, 0, -1.25);
const NEEDLE_DY = 0.135;
const ARM_Y = PLAT_TOP + REC_H + NEEDLE_DY;
const ARM_L = 2.4;
const R_OUT = 1.37, R_IN = 0.64;              // recorrido de la aguja
const LIFT_UP = 0.075, LIFT_REST = 0.035;
const REST_Z = 1.75;
const SPIN = (100 / 3 / 60) * Math.PI * 2;    // 33⅓ rpm
const DOCK_POS = new THREE.Vector3(-3.7, ST / 2 + 0.002, 0.3);
const DOCK_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0.16, 0, 'YXZ'));
const PLAT_WORLD = new THREE.Vector3(TT.x + PLAT.x, REC_Y, TT.z + PLAT.z);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const QX90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const IDENT = new THREE.Quaternion();

// ============================================================
// Renderer, escena, luces
// ============================================================
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const BG = 0xfcf7f9;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 24, 50);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 120);

scene.add(new THREE.HemisphereLight(0xffffff, 0xf3d2df, 0.9));
const key = new THREE.DirectionalLight(0xfff6f2, 2.0);
key.position.set(-4.5, 10, 6);
key.target.position.set(-0.6, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

const carLight = new THREE.SpotLight(0xffffff, 70, 30, 0.6, 0.9, 1.6);
carLight.position.set(0, 9, CAR_Z + 8);
carLight.target.position.set(0, 1.2, CAR_Z);
carLight.castShadow = true;
carLight.shadow.mapSize.set(1024, 1024);
carLight.shadow.bias = -0.0004;
scene.add(carLight, carLight.target);

const rim = new THREE.PointLight(0xff8fb8, 14, 18, 1.6);
rim.position.set(4.5, 5.5, -5);
scene.add(rim);
const carRim = new THREE.PointLight(0xff8fb8, 22, 18, 1.8);
carRim.position.set(0, 4, CAR_Z - 4);
scene.add(carRim);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3f7, emissiveIntensity: 0.35, roughness: 1, metalness: 0, envMapIntensity: 0.2 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

function texFrom(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
}

// ============================================================
// Tocadiscos
// ============================================================
const chrome = new THREE.MeshStandardMaterial({ color: 0xeceaee, metalness: 1, roughness: 0.18 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0xf1e4ea, metalness: 0.35, roughness: 0.32 }); // perla
const blackGloss = new THREE.MeshStandardMaterial({ color: 0x2b2329, metalness: 0.2, roughness: 0.28 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0xf0699a, metalness: 0.35, roughness: 0.3 });

const tt = new THREE.Group();
tt.position.copy(TT);
scene.add(tt);

function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
  add(tt, new THREE.CylinderGeometry(0.26, 0.3, FEET, 32), darkMetal, sx * (PL_W / 2 - 0.45), FEET / 2, sz * (PL_D / 2 - 0.45));
}
// base lacada en rosa pastel
const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0xf6cfdd, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.35 });
add(tt, new RoundedBoxGeometry(PL_W, PL_H, PL_D, 5, 0.09), plinthMat, 0, FEET + PL_H / 2, 0);

// plato
add(tt, new THREE.CylinderGeometry(1.64, 1.64, 0.04, 96), darkMetal, PLAT.x, TOP + 0.02, PLAT.z);
const platter = new THREE.Group();
platter.position.set(PLAT.x, 0, PLAT.z);
tt.add(platter);
const strobeTex = texFrom(T.makeStrobe());
strobeTex.wrapS = THREE.RepeatWrapping;
add(platter, new THREE.CylinderGeometry(1.58, 1.58, 0.13, 128, 1, false),
  [new THREE.MeshStandardMaterial({ map: strobeTex, metalness: 0.9, roughness: 0.3 }), chrome, chrome], 0, TOP + 0.04 + 0.065, 0);
add(platter, new THREE.CylinderGeometry(1.5, 1.5, 0.012, 96), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 0, TOP + 0.17 + 0.006, 0); // fieltro blanco
add(platter, new THREE.CylinderGeometry(0.028, 0.03, 0.11, 24), chrome, 0, PLAT_TOP + 0.055, 0);

// reflejo fijo sobre el disco
const sheen = new THREE.Mesh(
  new THREE.RingGeometry(REC_R * 0.335, REC_R * 0.995, 160, 1),
  new THREE.MeshBasicMaterial({ map: texFrom(T.makeSheen()), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
);
sheen.rotation.x = -Math.PI / 2;
sheen.position.set(PLAT.x, PLAT_TOP + REC_H + 0.003, PLAT.z);
sheen.renderOrder = 2;
tt.add(sheen);

// brazo
const armBase = new THREE.Group();
armBase.position.set(PIVOT.x, TOP, PIVOT.z);
tt.add(armBase);
add(armBase, new THREE.CylinderGeometry(0.36, 0.38, 0.06, 48), darkMetal, 0, 0.03, 0);
add(armBase, new THREE.CylinderGeometry(0.09, 0.11, ARM_Y - TOP - 0.04, 32), chrome, 0, (ARM_Y - TOP - 0.04) / 2 + 0.05, 0);
add(armBase, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 24), accentMat, 0.26, 0.085, 0.12); // antiskating
// palanca de elevación
const cue = add(armBase, new THREE.BoxGeometry(0.05, 0.05, 0.36), chrome, 0.3, 0.2, 0.32);
cue.rotation.y = 0.5;

const armYaw = new THREE.Group();
armYaw.position.set(PIVOT.x, ARM_Y, PIVOT.z);
tt.add(armYaw);
const armLift = new THREE.Group();
armYaw.add(armLift);
const along = (r, len) => new THREE.CylinderGeometry(r, r, len, 24).rotateX(Math.PI / 2);
add(armLift, new THREE.CylinderGeometry(0.11, 0.11, 0.22, 32).rotateZ(Math.PI / 2), darkMetal, 0, 0, 0);
const TUBE_END = ARM_L - 0.36;
add(armLift, along(0.032, TUBE_END + 0.75), chrome, 0, 0, (TUBE_END - 0.75) / 2);
add(armLift, along(0.15, 0.34), darkMetal, 0, 0, -0.62);
add(armLift, along(0.153, 0.04), chrome, 0, 0, -0.45);
// cabezal: su origen es la punta de la aguja
const head = new THREE.Group();
head.position.set(0, -NEEDLE_DY, ARM_L);
head.rotation.y = 0.32;
armLift.add(head);
add(head, new THREE.BoxGeometry(0.21, 0.025, 0.42), blackGloss, 0, 0.125, -0.07);
add(head, new THREE.BoxGeometry(0.15, 0.085, 0.21), accentMat, 0, 0.07, -0.02);
add(head, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 12).rotateZ(Math.PI / 2), chrome, 0.17, 0.13, -0.14); // levantador
add(head, new THREE.ConeGeometry(0.012, 0.03, 12).rotateX(Math.PI), chrome, 0, 0.016, 0);
{ // conector entre tubo y cabezal
  const a = new THREE.Vector3(0, 0, TUBE_END);
  const b = new THREE.Vector3(0, 0.125, -0.27).applyAxisAngle(Y_AXIS, head.rotation.y).add(head.position);
  const len = a.distanceTo(b) + 0.04;
  const c = add(armLift, new THREE.CylinderGeometry(0.034, 0.034, len, 16), chrome, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  c.quaternion.setFromUnitVectors(Y_AXIS, b.clone().sub(a).normalize());
}
// zona táctil invisible y generosa para arrastrar el brazo
const armHit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, ARM_L + 0.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
armHit.position.set(0, -0.05, ARM_L / 2 + 0.05);
armLift.add(armHit);
// soporte de descanso
{
  const top = ARM_Y + REST_Z * Math.sin(LIFT_REST) - 0.034;
  add(tt, new THREE.CylinderGeometry(0.035, 0.045, top - TOP, 16), chrome, PIVOT.x, TOP + (top - TOP) / 2, PIVOT.z + REST_Z);
  add(tt, new THREE.BoxGeometry(0.16, 0.035, 0.07), darkMetal, PIVOT.x, top, PIVOT.z + REST_Z);
}

// botón de arranque, velocidades y LED
const btnGroup = new THREE.Group();
btnGroup.position.set(-PL_W / 2 + 0.48, TOP, PL_D / 2 - 0.42);
tt.add(btnGroup);
add(btnGroup, new THREE.CylinderGeometry(0.24, 0.24, 0.02, 40), darkMetal, 0, 0.01, 0);
const startBtn = add(btnGroup, new THREE.CylinderGeometry(0.18, 0.18, 0.06, 40), chrome, 0, 0.04, 0);
const ledMat = new THREE.MeshStandardMaterial({ color: 0xf7d5e2, emissive: 0xff4f8f, emissiveIntensity: 0.1 });
add(btnGroup, new THREE.SphereGeometry(0.035, 16, 12), ledMat, 0.36, 0.02, 0);
const speedMat = new THREE.MeshStandardMaterial({ color: 0xf4eef1, metalness: 0.2, roughness: 0.3 });
add(btnGroup, new RoundedBoxGeometry(0.26, 0.05, 0.14, 2, 0.02), speedMat, 0.68, 0.025, 0);
add(btnGroup, new RoundedBoxGeometry(0.26, 0.05, 0.14, 2, 0.02), speedMat, 0.98, 0.025, 0);
add(btnGroup, new THREE.SphereGeometry(0.018, 12, 8), ledMat, 0.68, 0.06, -0.12);
const startHit = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16), armHit.material);
startHit.position.set(0, 0.1, 0);
btnGroup.add(startHit);
// placa
const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.25), new THREE.MeshStandardMaterial({ map: texFrom(T.makePlate('BTS · ARMY')), metalness: 0.4, roughness: 0.4 }));
plate.rotation.x = -Math.PI / 2;
plate.position.set(0.6, TOP + 0.003, PL_D / 2 - 0.3);
tt.add(plate);

// ============================================================
// Vinilo activo
// ============================================================
const recordGroup = new THREE.Group();
scene.add(recordGroup);
const recTopMat = new THREE.MeshPhysicalMaterial({ roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.3, envMapIntensity: 0.55 });
const recSideMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.35 });
const disc = new THREE.Mesh(new THREE.CylinderGeometry(REC_R, REC_R, REC_H, 160), [recSideMat, recTopMat, recTopMat]);
disc.castShadow = true; disc.receiveShadow = true;
recordGroup.add(disc);
let recAlbumId = null;
const vinylCache = new Map();

function setRecordAlbum(a) {
  let c = vinylCache.get(a.id);
  if (!c) {
    c = T.makeVinyl(a, a._cover, { rStart: R_OUT / REC_R + 0.01, rEnd: R_IN / REC_R - 0.01, rLabel: 0.335 });
    vinylCache.set(a.id, c);
    if (vinylCache.size > 3) vinylCache.delete(vinylCache.keys().next().value);
  }
  const old = recTopMat.map;
  recTopMat.map = texFrom(c);
  recTopMat.map.anisotropy = maxAniso;
  recTopMat.needsUpdate = true;
  old?.dispose();
  recSideMat.color.set(a.vinyl || '#121212').multiplyScalar(0.7);
  recAlbumId = a.id;
}

// ============================================================
// Álbumes y fundas
// ============================================================
let albums = [];
const sleeveGeo = new THREE.BoxGeometry(S, S, ST);

const persistKeys = ['id', 'title', 'artist', 'year', 'vinyl', 'palette', 'order', 'tracks', 'cover', 'itunesId', 'itunesHint'];
const serialize = (a) => Object.fromEntries(persistKeys.map((k) => [k, a[k]]));

async function prepareAlbum(a) {
  let img = null;
  if (a.cover) { try { img = await createImageBitmap(a.cover); } catch { img = null; } }
  a._cover = T.makeCover(a, img);
  a._edge = img ? T.averageColor(a._cover) : (a.palette?.bg?.[1] || '#222');
  a._coverUrl = null;
}

function sleeveMaterials(a) {
  return [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: new THREE.Color(a._edge), roughness: 0.7 })),
    new THREE.MeshStandardMaterial({ map: texFrom(a._cover), roughness: 0.55, envMapIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ map: texFrom(T.makeBack(a, a._cover)), roughness: 0.6, envMapIntensity: 0.3 }),
  ];
}
function disposeSleeve(m) {
  for (const mat of new Set(m.material)) { mat.map?.dispose(); mat.dispose(); }
}
function buildSleeve(a) {
  const m = new THREE.Mesh(sleeveGeo, sleeveMaterials(a));
  m.castShadow = true; m.receiveShadow = true;
  m.userData.album = a;
  scene.add(m);
  a._sleeve = m;
}
function refreshSleeve(a) {
  disposeSleeve(a._sleeve);
  a._sleeve.material = sleeveMaterials(a);
}

const LEGACY_DEFAULTS = 17; // álbumes que traía la primera versión, antes de guardar la lista de ids
let addedDefaults = 0;

async function loadAlbums() {
  let list = await db.getAll('albums');
  const seeded = await db.get('meta', 'seeded');
  // los álbumes de serie ya ofrecidos no se vuelven a añadir (aunque se hayan borrado);
  // los nuevos de una actualización (p. ej. ARIRANG) aparecen al final de la colección
  const known = new Set(seeded ? seeded.ids || DEFAULT_ALBUMS.slice(0, LEGACY_DEFAULTS).map((a) => 'bts-' + a.slug) : []);
  let order = list.reduce((m, a) => Math.max(m, a.order ?? 0), -1) + 1;
  const seeds = DEFAULT_ALBUMS
    .filter((a) => !known.has('bts-' + a.slug) && !list.some((x) => x.id === 'bts-' + a.slug))
    .map((a) => ({
      id: 'bts-' + a.slug, title: a.title, artist: 'BTS', year: a.year, vinyl: a.vinyl,
      palette: a.palette, order: order++, tracks: [], cover: null, itunesHint: a.itunesHint,
    }));
  if (seeds.length || !seeded?.ids) {
    await db.putMany('albums', seeds);
    await db.put('meta', { key: 'seeded', value: true, ids: DEFAULT_ALBUMS.map((a) => 'bts-' + a.slug) });
    list = [...list, ...seeds];
    if (seeded) addedDefaults = seeds.length;
  }
  list.sort((a, b) => a.order - b.order);
  return list;
}

/** Aplica portada y canciones del catálogo a un álbum y refresca su funda. */
async function applyCatalog(a, { match, tracks, cover }) {
  if (!a.cover) a.cover = cover;
  a.tracks = catalog.mergeTracks(tracks, a.tracks);
  a.itunesId = match.id;
  if (!a.year && match.year) a.year = +match.year;
  await db.put('albums', serialize(a));
  await prepareAlbum(a);
  refreshSleeve(a);
  vinylCache.delete(a.id);
  if (recAlbumId === a.id && mode === 'library') setRecordAlbum(a);
}

// ============================================================
// Carrusel (cover-flow)
// ============================================================
const car = { scroll: 0, target: 0, vel: 0, dragging: false, peek: 0 };
let mode = 'library';      // library | toPlayer | player | toLibrary
const trans = { t: 0 };    // 0 = biblioteca, 1 = tocadiscos
let sel = -1;

const centerIndex = () => (albums.length ? clamp(Math.round(car.scroll), 0, albums.length - 1) : -1);

function flowTransform(d, outP, outQ) {
  const a = Math.abs(d), s = Math.sign(d);
  let x, z, ry;
  if (a < 1) { x = d * S * 1.3; z = -a * 2.2; ry = -d * 1.05; }
  else { x = s * (S * 1.3 + (a - 1) * S * 0.36); z = -2.2 - (a - 1) * 0.3; ry = -s * 1.05; }
  outP.set(x, CAR_Y, CAR_Z + z);
  outQ.setFromAxisAngle(Y_AXIS, ry);
}

const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function sleeveTransform(i, outP, outQ) {
  flowTransform(i - car.scroll, outP, outQ);
  if (i === sel && mode !== 'library') {
    const s = ease(clamp(trans.t / 0.6, 0, 1));
    _p2.copy(outP).lerp(DOCK_POS, s);
    _p2.y += Math.sin(Math.PI * s) * 1.4;
    outP.copy(_p2);
    outQ.slerp(DOCK_Q, s);
  }
}

let recOnPlatter = false;
let clock = 0;
function layoutObjects() {
  albums.forEach((a, i) => {
    const m = a._sleeve;
    m.visible = Math.abs(i - car.scroll) < 7 || (i === sel && mode !== 'library');
    if (m.visible) sleeveTransform(i, m.position, m.quaternion);
    // flotación suave de la funda central
    const f = (1 - Math.min(1, Math.abs(i - car.scroll))) * (1 - trans.t);
    if (f > 0) m.position.y += Math.sin(clock * 1.1) * 0.05 * f;
  });
  const ri = albums.findIndex((a) => a.id === recAlbumId);
  if (ri < 0) { recordGroup.visible = false; return; }
  const sm = albums[ri]._sleeve;
  _p.set(car.peek * PEEK, 0, 0).applyQuaternion(sm.quaternion).add(sm.position);
  _q.copy(sm.quaternion).multiply(QX90);
  const k = mode !== 'library' && ri === sel ? ease(clamp((trans.t - 0.5) / 0.5, 0, 1)) : 0;
  recordGroup.position.copy(_p).lerp(PLAT_WORLD, k);
  recordGroup.position.y += Math.sin(Math.PI * k) * 1.0;
  recordGroup.quaternion.copy(_q).slerp(IDENT, k);
  recordGroup.visible = car.peek > 0.01 || k > 0;
  recOnPlatter = k >= 0.999;
  sheen.material.opacity = 0.3 * smooth(clamp((k - 0.9) / 0.1, 0, 1));
}

let lastCenter = -2;
function updateCarousel(dt) {
  if (!car.dragging) car.scroll += (car.target - car.scroll) * Math.min(1, dt * 7);
  const ci = centerIndex();
  if (ci !== lastCenter) { lastCenter = ci; updateLibInfo(); }
  const settled = !car.dragging && Math.abs(car.target - car.scroll) < 0.03;
  let target = 0;
  if (mode !== 'library') target = 1;
  else if (settled && ci >= 0 && albums[ci].id === recAlbumId) target = 1;
  car.peek += (target - car.peek) * Math.min(1, dt * (target > car.peek ? 3.5 : 10));
  if (mode === 'library' && settled && ci >= 0 && albums[ci].id !== recAlbumId && car.peek < 0.02) setRecordAlbum(albums[ci]);
}

// ============================================================
// Cámara
// ============================================================
function panelLayout() {
  const W = innerWidth, H = innerHeight;
  if (W >= H) { const P = clamp(W * 0.34, 320, 430) + 28; return { availW: W - P, availH: H, dx: P / 2, dy: 0 }; }
  const P = H * 0.42 + 24;
  return { availW: W, availH: H - P, dx: 0, dy: P / 2 };
}
function fitDistance(halfW, halfH, availW, availH, fh) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max((halfW * fh) / (t * availW), (halfH * fh) / (t * availH));
}
const LIB_DIR = new THREE.Vector3(0, 0.1, 1).normalize();
const PL_DIR = new THREE.Vector3(0.04, 1.45, 1).normalize();
function camConfig(kind) {
  const W = innerWidth, H = innerHeight;
  if (kind === 'lib') {
    const dy = Math.min(125, H * 0.14);
    const portrait = W < H;
    const target = new THREE.Vector3(portrait ? 0 : 0.6, CAR_Y + 0.05, CAR_Z);
    const d = fitDistance(portrait ? 1.9 : 3.4, 2.15, W, H - 2 * dy, H + 2 * dy);
    return { pos: target.clone().addScaledVector(LIB_DIR, d), target, dx: 0, dy };
  }
  const L = panelLayout();
  const target = new THREE.Vector3(-1.05, 0.35, 0.3);
  const d = fitDistance(4.6, 2.1, L.availW, L.availH, H + 2 * L.dy);
  return { pos: target.clone().addScaledVector(PL_DIR, d), target, dx: L.dx, dy: L.dy };
}
const _tgt = new THREE.Vector3();
function updateCamera() {
  const a = camConfig('lib'), b = camConfig('player');
  const k = ease(clamp(trans.t / 0.85, 0, 1));
  camera.position.lerpVectors(a.pos, b.pos, k);
  camera.position.y += Math.sin(Math.PI * k) * 1.5;
  _tgt.lerpVectors(a.target, b.target, k);
  camera.lookAt(_tgt);
  const dx = lerp(a.dx, b.dx, k), dy = lerp(a.dy, b.dy, k);
  const W = innerWidth, H = innerHeight;
  const fw = W + 2 * Math.abs(dx), fh = H + 2 * Math.abs(dy);
  camera.aspect = fw / fh;
  camera.setViewOffset(fw, fh, Math.abs(dx) + dx, Math.abs(dy) + dy, W, H);
}

// ============================================================
// Animaciones con token de cancelación
// ============================================================
const tweens = [];
let seq = 0;
function animate(dur, fn, token) {
  return new Promise((res) => tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, token, res }));
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.token !== undefined && tw.token !== seq) { tweens.splice(i, 1); tw.res(false); continue; }
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(true); }
  }
}

// ============================================================
// Brazo: geometría de la aguja
// ============================================================
const arm = { theta: 0, lift: LIFT_REST, dragTheta: 0, dragOffset: 0 };
function needleR(th) {
  const x = PIVOT.x + ARM_L * Math.sin(th) - PLAT.x;
  const z = PIVOT.z + ARM_L * Math.cos(th) - PLAT.z;
  return Math.hypot(x, z);
}
const THETA_C = Math.atan2(PLAT.x - PIVOT.x, PLAT.z - PIVOT.z);
function thetaForR(r) {
  let lo = THETA_C, hi = 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (needleR(mid) > r) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
const THETA_MIN = thetaForR(R_IN - 0.08);
const rForP = (p) => R_OUT - clamp(p, 0, 1) * (R_OUT - R_IN);

function tweenArm(to, dur, token) {
  const from = { theta: arm.theta, lift: arm.lift };
  return animate(dur, (k) => {
    const e = ease(k);
    if (to.theta !== undefined) arm.theta = lerp(from.theta, to.theta, e);
    if (to.lift !== undefined) arm.lift = lerp(from.lift, to.lift, e);
  }, token);
}

// ============================================================
// Reproducción
// ============================================================
// Dos fuentes con la misma forma: <audio> (archivos propios y avances) y el reproductor de YouTube.
const audio = new Audio();
audio.preload = 'auto';
const yt = new YouTubeMedia($('#yt-player'));
let media = audio;
let audioUrl = null, loadedTrackId = null, internalPause = false, ytWarned = false;
const P = { album: null, index: 0, state: 'rest', intent: 'stop', motor: 0, motorTarget: 0 };
let spin = 0;

function pauseAudio() { internalPause = true; audio.pause(); yt.pause(); internalPause = false; }

// duración "de surco" de cada pista: la real del álbum, así el brazo recorre el disco como en un vinilo
const trackLen = (t) => (t.file !== false ? t.duration : t.full || t.duration) || 200;
const durs = () => P.album.tracks.map(trackLen);
const isLoaded = (i) => P.album?.tracks[i]?.id === loadedTrackId;
function mediaDuration(i = P.index) {
  const d = isLoaded(i) ? media.duration : NaN;
  return isFinite(d) && d > 0 ? d : trackLen(P.album.tracks[i]);
}
function curTime() { return isLoaded(P.index) ? media.currentTime || 0 : 0; }
function albumProgress(index = P.index, time = curTime()) {
  if (!P.album?.tracks.length) return 0;
  const d = durs();
  const tot = d.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < index; i++) acc += d[i];
  const frac = clamp(time / mediaDuration(index), 0, 1);
  return clamp((acc + frac * d[index]) / tot, 0, 1);
}
/** Posición del brazo -> pista y fracción dentro de la pista. */
function locate(p) {
  const d = durs();
  let left = p * d.reduce((a, b) => a + b, 0);
  for (let i = 0; i < d.length; i++) {
    if (left < d[i] || i === d.length - 1) return { index: i, frac: clamp(left / d[i], 0, 0.98) };
    left -= d[i];
  }
  return { index: 0, frac: 0 };
}

const ytKey = () => settings.ytKey || DEFAULT_YT_KEY;
const useYouTube = () => settings.source === 'youtube' && !!ytKey();

function showScreen(on) { $('#player-ui').classList.toggle('yt-on', on); }

async function loadYouTube(tr) {
  if (!navigator.onLine || tr.ytBlocked) return false;
  try {
    if (!tr.yt) {
      const found = await findVideo(ytKey(), { title: tr.title, album: P.album.title, artist: P.album.artist || 'BTS', exclude: tr.ytBad || [] });
      if (!found) { tr.ytBlocked = true; db.put('albums', serialize(P.album)); return false; }
      tr.yt = found.id;
      tr.ytAlt = found.alts;
      db.put('albums', serialize(P.album));
    }
    await yt.load(tr.yt);
    return true;
  } catch (e) {
    if (!ytWarned) { toast(`${e.message || 'YouTube no disponible.'} Uso el avance de 30 s.`); ytWarned = true; }
    return false;
  }
}

async function loadTrack(i) {
  const tr = P.album.tracks[i];
  if (!tr) return false;
  if (loadedTrackId === tr.id) return true;
  audio.pause(); yt.stop();
  let src = null;
  if (tr.file !== false) {
    const rec = await db.get('tracks', tr.id);
    if (!rec) { toast(`No encuentro el archivo de "${tr.title}".`); return false; }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    src = audioUrl = URL.createObjectURL(rec.blob);
  } else if (useYouTube() && await loadYouTube(tr)) {
    media = yt;
    loadedTrackId = tr.id;
    showScreen(true);
    return true;
  } else {
    // avance de 30 s del catálogo de iTunes (necesita internet)
    if (!tr.previewUrl || !navigator.onLine) { toast(`"${tr.title}" no tiene audio disponible sin conexión.`); return false; }
    src = tr.previewUrl;
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  }
  media = audio;
  showScreen(false);
  loadedTrackId = tr.id;
  audio.src = src;
  await new Promise((r) => {
    const fin = () => { audio.removeEventListener('loadedmetadata', fin); r(); };
    audio.addEventListener('loadedmetadata', fin);
    setTimeout(fin, 4000);
  });
  if (tr.file !== false && isFinite(audio.duration) && Math.abs((tr.duration || 0) - audio.duration) > 1) {
    tr.duration = audio.duration;
    db.put('albums', serialize(P.album));
  }
  return true;
}

function startMedia() {
  const p = media.play();
  if (media === yt) {
    // si el navegador bloquea el inicio automático, el usuario puede tocar la pantallita
    setTimeout(() => { if (P.state === 'playing' && media === yt && !yt.started) toast('Toca el video para empezar a sonar.'); }, 3500);
  }
  Promise.resolve(p).catch(() => toast('Toca ▶ para empezar a sonar.'));
}

function motorOn() { if (P.motorTarget !== 1) { P.motorTarget = 1; sfx.click(); } }
function motorOff() { P.motorTarget = 0; }

async function playFrom(index, time = 0, { theta, frac } = {}) {
  if (!P.album || mode !== 'player') return;
  const tok = ++seq;
  sfx.init();
  P.intent = 'play';
  pauseAudio(); sfx.setCrackle(false);
  P.state = 'moving';
  motorOn();
  keepAwake(true);
  const has = P.album.tracks.length > 0;
  if (has) {
    index = clamp(index, 0, P.album.tracks.length - 1);
    P.index = index;
    renderNowPlaying();
    const ok = await loadTrack(index);
    if (tok !== seq) return;
    if (!ok) { park(); return; }
    if (frac !== undefined) time = frac * mediaDuration(index);
    try { media.currentTime = time; } catch { /* ignore */ }
  }
  const target = theta ?? thetaForR(rForP(has ? albumProgress(index, time) : 0));
  if (arm.lift < LIFT_UP - 0.005) {
    if (arm.lift < 0.01) sfx.needleLift();
    if (!(await tweenArm({ lift: LIFT_UP }, 0.3, tok))) return;
  }
  if (!(await tweenArm({ theta: target }, 0.35 + Math.abs(target - arm.theta) * 1.8, tok))) return;
  if (!(await tweenArm({ lift: 0 }, 0.5, tok))) return;
  sfx.needleDrop();
  P.state = 'playing';
  sfx.setCrackle(true);
  renderNowPlaying();
  if (has) {
    await sleep(300);
    if (tok !== seq) return;
    startMedia();
  }
  updateMediaSession();
}

async function cuePause() {
  if (P.state !== 'playing' && P.state !== 'moving') return;
  const tok = ++seq;
  P.intent = 'stop';
  pauseAudio(); sfx.setCrackle(false);
  P.state = 'cued';
  renderNowPlaying();
  if (arm.lift < 0.01) sfx.needleLift();
  await tweenArm({ lift: LIFT_UP }, 0.35, tok);
}

async function park() {
  const tok = ++seq;
  P.intent = 'stop';
  pauseAudio(); sfx.setCrackle(false);
  P.state = 'moving';
  renderNowPlaying();
  if (arm.lift < LIFT_UP - 0.005) {
    if (arm.lift < 0.01) sfx.needleLift();
    if (!(await tweenArm({ lift: LIFT_UP }, 0.3, tok))) return false;
  }
  if (!(await tweenArm({ theta: 0 }, 0.35 + Math.abs(arm.theta) * 1.5, tok))) return false;
  if (!(await tweenArm({ lift: LIFT_REST }, 0.3, tok))) return false;
  P.state = 'rest';
  motorOff();
  keepAwake(false);
  renderNowPlaying();
  return true;
}

function togglePlay() {
  if (!P.album || mode !== 'player') return;
  if (P.intent === 'play') cuePause();
  else {
    if (!P.album.tracks.length) toast('Este álbum aún no tiene canciones: toca "Editar" para añadirlas.');
    playFrom(P.index, curTime());
  }
}
function next() { if (P.album?.tracks.length && P.index < P.album.tracks.length - 1) playFrom(P.index + 1, 0); }
function prev() {
  if (!P.album?.tracks.length) return;
  if (curTime() > 3 || P.index === 0) playFrom(P.index, 0); else playFrom(P.index - 1, 0);
}

async function onEnded() {
  if (P.state !== 'playing') return;
  if (P.index < P.album.tracks.length - 1) {
    const tok = seq;
    P.index++;
    renderNowPlaying();
    const ok = await loadTrack(P.index);
    if (tok !== seq) return;
    if (!ok) { park(); return; }
    media.currentTime = 0;
    startMedia();
    updateMediaSession();
  } else {
    // fin de la cara: la aguja gira en el surco final y luego vuelve
    const tok = ++seq;
    P.state = 'runout';
    if (!(await tweenArm({ theta: thetaForR(R_IN - 0.05) }, 2.2, tok))) return;
    await sleep(2500);
    if (tok !== seq) return;
    P.index = 0;
    loadedTrackId = null;
    park();
  }
}
function onExternalPause(e) {
  // pausa externa (auriculares, notificación, toque en el video): levantamos la aguja
  if (e.target !== media || internalPause) return;
  if (P.state === 'playing' && !media.ended) cuePause();
}
for (const m of [audio, yt]) {
  m.addEventListener('ended', (e) => { if (e.target === media) onEnded(); });
  m.addEventListener('pause', onExternalPause);
}
yt.addEventListener('playing', () => {
  // empezó a sonar tocando el video directamente
  if (media === yt && P.state === 'cued') playFrom(P.index, curTime());
});
// Video bloqueado por la discográfica fuera de YouTube: probamos otra versión oficial y, si no hay, el avance.
yt.addEventListener('error', (e) => {
  const tr = P.album?.tracks.find((t) => t.yt && t.yt === yt.videoId);
  if (!tr) return;
  if (!isBlockedError(e.detail)) { toast('YouTube tuvo un problema con este video.'); return; }
  tr.ytBad = [...new Set([...(tr.ytBad || []), tr.yt])];
  const searched = Array.isArray(tr.ytAlt);
  tr.yt = (tr.ytAlt || []).find((id) => !tr.ytBad.includes(id)) || null;
  // sin alternativas: si ya se buscaron, queda el avance; si es un dato antiguo, se vuelve a buscar una vez
  if (!tr.yt && searched) tr.ytBlocked = true;
  if (!tr.yt && !searched) tr.ytAlt = [];
  db.put('albums', serialize(P.album));
  yt.stop();
  const current = P.album.tracks[P.index] === tr;
  if (current) loadedTrackId = null;
  toast(tr.yt || !tr.ytBlocked ? 'Esa versión está bloqueada fuera de YouTube; pruebo otra…' : `"${tr.title}" no se puede ver fuera de YouTube; suena el avance de 30 s.`);
  if (current && P.intent === 'play') playFrom(P.index, 0);
});

// arrastre del brazo
const armPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ARM_Y);
const _hit = new THREE.Vector3();
function pointerTheta(e) {
  setRay(e);
  if (!ray.ray.intersectPlane(armPlane, _hit)) return null;
  return Math.atan2(_hit.x - TT.x - PIVOT.x, _hit.z - TT.z - PIVOT.z);
}
function beginArmDrag(e) {
  seq++;
  pauseAudio(); sfx.setCrackle(false);
  if (arm.lift < 0.01) sfx.needleLift();
  P.state = 'drag';
  motorOn();
  const th = pointerTheta(e);
  arm.dragOffset = th === null ? 0 : arm.theta - th;
  arm.dragTheta = arm.theta;
}
function dragArm(e) {
  const th = pointerTheta(e);
  if (th !== null) arm.dragTheta = clamp(th + arm.dragOffset, THETA_MIN, 0);
}
function endArmDrag() {
  const r = needleR(arm.theta);
  if (r > R_OUT + 0.12) { park(); return; }
  if (P.album.tracks.length) {
    const { index, frac } = locate(clamp((R_OUT - r) / (R_OUT - R_IN), 0, 1));
    playFrom(index, 0, { theta: arm.theta, frac });
  } else playFrom(0, 0, { theta: arm.theta });
}

function updateDeck(dt) {
  if (P.motor < P.motorTarget) P.motor = Math.min(1, P.motor + dt / 1.1);
  else if (P.motor > P.motorTarget) P.motor = Math.max(0, P.motor - dt / 2.4);
  spin -= P.motor * SPIN * dt;
  platter.rotation.y = spin;
  disc.rotation.y = spin;
  ledMat.emissiveIntensity = lerp(ledMat.emissiveIntensity, P.motorTarget ? 3 : 0.1, Math.min(1, dt * 8));

  if (P.state === 'drag') {
    arm.theta += (arm.dragTheta - arm.theta) * Math.min(1, dt * 14);
    arm.lift += (LIFT_UP - arm.lift) * Math.min(1, dt * 10);
  } else if (P.state === 'playing' && P.album?.tracks.length) {
    const tgt = thetaForR(rForP(albumProgress()));
    arm.theta += (tgt - arm.theta) * Math.min(1, dt * 3);
  }
  armYaw.rotation.y = arm.theta;
  armLift.rotation.x = -arm.lift;
}

// ============================================================
// Transiciones biblioteca <-> tocadiscos
// ============================================================
async function enterPlayer(i) {
  if (mode !== 'library' || i < 0 || i >= albums.length) return;
  sfx.init();
  const a = albums[i];
  sel = i;
  car.target = i;
  if (recAlbumId !== a.id) setRecordAlbum(a);
  mode = 'toPlayer';
  $('#lib-ui').classList.remove('show');
  P.album = a; P.index = 0; P.state = 'rest'; P.intent = 'stop';
  loadedTrackId = null;
  renderPlayer();
  let shown = false;
  const from = trans.t;
  await animate(2.5 * (1 - from), (k) => {
    trans.t = lerp(from, 1, k);
    if (!shown && trans.t > 0.65) { shown = true; $('#player-ui').classList.add('show'); }
  });
  mode = 'player';
  $('#player-ui').classList.add('show');
  if (a.tracks.length) playFrom(0, 0);
  else toast('Este álbum aún no tiene canciones: toca "Editar" para añadirlas.');
}

async function goLibrary() {
  if (mode !== 'player') return;
  $('#player-ui').classList.remove('show');
  if (P.state !== 'rest') await park();
  P.state = 'rest'; arm.theta = 0; arm.lift = LIFT_REST; motorOff();
  mode = 'toLibrary';
  const from = trans.t;
  await animate(2.1 * from, (k) => { trans.t = lerp(from, 0, k); });
  mode = 'library';
  sel = -1;
  P.album = null;
  pauseAudio();
  yt.stop();
  loadedTrackId = null;
  showScreen(false);
  keepAwake(false);
  $('#lib-ui').classList.add('show');
  updateLibInfo();
}

// ============================================================
// Entrada táctil
// ============================================================
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function pick(e, objs) { setRay(e); return ray.intersectObjects(objs, false)[0]; }

let ptr = null;
const pxPerItem = () => Math.max(170, Math.min(innerWidth, innerHeight) * 0.42);

canvas.addEventListener('pointerdown', (e) => {
  if (ptr) return;
  sfx.init();
  ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: performance.now(), moved: false, kind: 'none' };
  if (mode === 'library') { ptr.kind = 'carousel'; car.dragging = true; car.vel = 0; }
  else if (mode === 'player') {
    const hit = pick(e, [armHit, startHit, albums[sel]?._sleeve].filter(Boolean));
    if (hit?.object === armHit) { ptr.kind = 'arm'; beginArmDrag(e); }
    else if (hit?.object === startHit) ptr.kind = 'start';
    else if (hit) ptr.kind = 'sleeve';
  }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  if (Math.hypot(e.clientX - ptr.x0, e.clientY - ptr.y0) > 8) ptr.moved = true;
  if (ptr.kind === 'carousel') {
    const now = performance.now();
    const dt = Math.max(1, now - ptr.lt) / 1000;
    const ds = -(e.clientX - ptr.lx) / pxPerItem();
    car.scroll = clamp(car.scroll + ds, -0.45, albums.length - 0.55);
    car.vel = lerp(car.vel, ds / dt, 0.35);
    ptr.lt = now;
  } else if (ptr.kind === 'arm') dragArm(e);
  ptr.lx = e.clientX;
});
function endPointer(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr;
  ptr = null;
  if (p.kind === 'carousel') {
    car.dragging = false;
    if (performance.now() - p.lt > 120) car.vel = 0;
    if (!p.moved) {
      const hit = pick(e, [...albums.map((a) => a._sleeve), disc]);
      if (hit) {
        const i = hit.object === disc ? albums.findIndex((a) => a.id === recAlbumId) : albums.findIndex((a) => a._sleeve === hit.object);
        if (i === centerIndex()) enterPlayer(i); else car.target = i;
      }
      car.target = clamp(Math.round(car.target), 0, albums.length - 1);
    } else {
      car.target = clamp(Math.round(car.scroll + car.vel * 0.2), 0, albums.length - 1);
    }
  } else if (p.kind === 'arm') endArmDrag();
  else if (p.kind === 'start' && !p.moved) { if (P.state === 'rest') playFrom(P.index, curTime()); else park(); }
  else if (p.kind === 'sleeve' && !p.moved) goLibrary();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

let wheelLock = 0;
canvas.addEventListener('wheel', (e) => {
  if (mode !== 'library' || performance.now() < wheelLock) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(d) < 4) return;
  car.target = clamp(Math.round(car.target) + Math.sign(d), 0, albums.length - 1);
  wheelLock = performance.now() + 140;
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (!$('#editor').hidden || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
  if (mode === 'library') {
    if (e.key === 'ArrowLeft') car.target = clamp(Math.round(car.target) - 1, 0, albums.length - 1);
    if (e.key === 'ArrowRight') car.target = clamp(Math.round(car.target) + 1, 0, albums.length - 1);
    if (e.key === 'Enter') enterPlayer(centerIndex());
  } else if (mode === 'player') {
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'Escape' || e.key === 'Backspace') goLibrary();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }
});

// ============================================================
// Interfaz HTML
// ============================================================
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function updateLibInfo() {
  const a = albums[centerIndex()];
  if (!a) {
    $('#lib-title').textContent = 'Tu colección está vacía';
    $('#lib-year').textContent = '';
    $('#lib-meta').textContent = 'Toca "+ Álbum" para crear uno.';
    $('#btn-put').disabled = $('#btn-edit').disabled = true;
    return;
  }
  $('#btn-put').disabled = $('#btn-edit').disabled = false;
  $('#lib-title').textContent = a.title;
  $('#lib-year').textContent = [a.artist || 'BTS', a.year].filter(Boolean).join(' · ');
  const n = a.tracks.length;
  const own = a.tracks.filter((t) => t.file !== false).length;
  const total = a.tracks.reduce((s, t) => s + (t.full || t.duration || 0), 0);
  $('#lib-meta').textContent = !n ? 'Sin canciones todavía'
    : `${n} ${n === 1 ? 'canción' : 'canciones'} · ${Math.round(total / 60)} min` +
      (own === n ? '' : useYouTube() ? ' · YouTube' : own ? ` · ${own} completas` : ' · avances de 30 s');
  const info = $('.lib-info');
  info.classList.remove('swap');
  void info.offsetWidth;
  info.classList.add('swap');
}

function coverUrl(a) {
  if (!a._coverUrl) {
    const c = T.canvas(512);
    c.getContext('2d').drawImage(a._cover, 0, 0, 512, 512);
    a._coverUrl = c.toDataURL('image/jpeg', 0.85);
  }
  return a._coverUrl;
}

function renderPlayer() {
  const a = P.album;
  if (!a) return;
  const c = $('#pl-cover');
  c.getContext('2d').drawImage(a._cover, 0, 0, c.width, c.height);
  $('#pl-artist').textContent = a.artist || 'BTS';
  $('#pl-title').textContent = a.title;
  $('#pl-year').textContent = a.year ? String(a.year) : '';
  const list = $('#pl-list');
  list.innerHTML = '';
  a.tracks.forEach((t, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="n"></span><span class="t"></span><span class="d"></span>';
    li.querySelector('.n').textContent = i + 1;
    li.querySelector('.t').textContent = t.title;
    const preview = t.file === false && !useYouTube();
    li.querySelector('.d').textContent = preview ? '30 s' : fmt(trackLen(t));
    if (preview) li.classList.add('preview');
    li.style.animationDelay = `${Math.min(i, 20) * 22}ms`;
    li.onclick = () => playFrom(i, 0);
    list.appendChild(li);
  });
  list.hidden = !a.tracks.length;
  $('#pl-empty').hidden = !!a.tracks.length;
  renderNowPlaying();
}

let seeking = false;
function renderNowPlaying() {
  const a = P.album;
  if (!a) return;
  const t = a.tracks[P.index];
  $('#pl-track').textContent = t ? t.title : 'Sin canciones';
  const dur = t ? mediaDuration() : 0;
  const cur = curTime();
  $('#pl-cur').textContent = fmt(cur);
  $('#pl-dur').textContent = fmt(dur);
  if (!seeking) { $('#pl-seek').value = dur ? Math.round((cur / dur) * 1000) : 0; paintRange($('#pl-seek')); }
  $('#btn-play').classList.toggle('playing', P.intent === 'play');
  [...$('#pl-list').children].forEach((li, i) => li.classList.toggle('current', i === P.index));
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !P.album) return;
  const t = P.album.tracks[P.index];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t?.title || P.album.title, artist: P.album.artist || 'BTS', album: P.album.title,
      artwork: [{ src: coverUrl(P.album), sizes: '512x512', type: 'image/jpeg' }],
    });
  } catch { /* ignore */ }
}
if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const h = (k, fn) => { try { ms.setActionHandler(k, fn); } catch { /* ignore */ } };
  h('play', () => { if (P.intent !== 'play') togglePlay(); });
  h('pause', () => { if (P.intent === 'play') cuePause(); });
  h('nexttrack', next);
  h('previoustrack', prev);
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && P.intent === 'play') keepAwake(true); });

// ajustes guardados
const settings = { vol: 0.9, crackle: 0.45, source: 'youtube', ytKey: '' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('bts-vinyl-settings') || '{}')); } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem('bts-vinyl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
audio.volume = yt.volume = settings.vol;
sfx.setCrackleLevel(settings.crackle);
$('#vol').value = settings.vol;
$('#crackle').value = settings.crackle;
// relleno rosa de los deslizadores
function paintRange(el) { el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`); }
document.querySelectorAll('input[type=range]').forEach((el) => { paintRange(el); el.addEventListener('input', () => paintRange(el)); });
$('#vol').addEventListener('input', (e) => { settings.vol = +e.target.value; audio.volume = yt.volume = settings.vol; saveSettings(); });

// ---------- ajustes: fuente de las canciones y clave de YouTube ----------
function openSettings() {
  $('#st-key').value = settings.ytKey || '';
  $(`input[name=st-source][value=${settings.source}]`).checked = true;
  $('#st-status').textContent = settings.ytKey ? 'Usando tu clave.' : DEFAULT_YT_KEY ? 'Usando la clave incluida en la app (no hace falta poner nada).' : '';
  $('#st-status').className = 'hint';
  const m = $('#settings');
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('open'));
}
function closeSettings() {
  const m = $('#settings');
  m.classList.remove('open');
  setTimeout(() => { if (!m.classList.contains('open')) m.hidden = true; }, 320);
}
$('#btn-settings').addEventListener('click', openSettings);
$('#btn-settings2').addEventListener('click', openSettings);
$('#st-close').addEventListener('click', closeSettings);
$('#st-test').addEventListener('click', async () => {
  const key = $('#st-key').value.trim() || DEFAULT_YT_KEY;
  const st = $('#st-status');
  if (!key) { st.textContent = 'Pega primero tu clave.'; return; }
  st.textContent = 'Comprobando…'; st.className = 'hint';
  try { await testKey(key); st.textContent = '✓ La clave funciona.'; st.className = 'hint ok'; }
  catch (e) { st.textContent = e.message; st.className = 'hint bad'; }
});
$('#st-save').addEventListener('click', () => {
  settings.ytKey = $('#st-key').value.trim();
  settings.source = $('input[name=st-source]:checked').value;
  saveSettings();
  ytWarned = false; // la próxima pista que se cargue ya usa la nueva configuración
  closeSettings();
  if (P.album) renderPlayer();
  lastCenter = -2;
  toast(useYouTube() ? 'Las canciones sonarán completas desde YouTube.' : settings.source === 'youtube' ? 'Falta la clave de YouTube: mientras tanto suenan avances.' : 'Usaré los avances de 30 s.');
});
$('#crackle').addEventListener('input', (e) => { settings.crackle = +e.target.value; sfx.init(); sfx.setCrackleLevel(settings.crackle); saveSettings(); });

$('#pl-seek').addEventListener('input', () => { seeking = true; });
$('#pl-seek').addEventListener('change', (e) => {
  seeking = false;
  const t = P.album?.tracks[P.index];
  if (!t) return;
  playFrom(P.index, 0, { frac: +e.target.value / 1000 });
});
$('#btn-play').addEventListener('click', togglePlay);
$('#btn-next').addEventListener('click', next);
$('#btn-prev').addEventListener('click', prev);
$('#btn-back').addEventListener('click', goLibrary);
$('#btn-put').addEventListener('click', () => enterPlayer(centerIndex()));
$('#nav-prev').addEventListener('click', () => { car.target = clamp(Math.round(car.target) - 1, 0, albums.length - 1); });
$('#nav-next').addEventListener('click', () => { car.target = clamp(Math.round(car.target) + 1, 0, albums.length - 1); });
$('#btn-fs').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => toast('Pantalla completa no disponible aquí.'));
});

// ============================================================
// Edición de álbumes
// ============================================================
function editAlbum(a) {
  if (!a) return;
  openEditor(a, { onSave: (d) => saveAlbum(d), onDelete: (x) => deleteAlbum(x) });
}
$('#btn-edit').addEventListener('click', () => editAlbum(albums[centerIndex()]));
$('#btn-edit2').addEventListener('click', () => editAlbum(P.album));
$('#btn-empty-add').addEventListener('click', () => editAlbum(P.album));
const nextOrder = () => albums.reduce((m, a) => Math.max(m, a.order ?? 0), -1) + 1;

// ---------- "+ Álbum": explorador de la discografía ----------
let pkFilter = 'albums';
function openModal(m) { m.hidden = false; requestAnimationFrame(() => m.classList.add('open')); }
function closeModal(m) { m.classList.remove('open'); setTimeout(() => { if (!m.classList.contains('open')) m.hidden = true; }, 320); }
const owned = (it) => albums.some((x) => x.itunesId === it.id || catalog.releaseKey(x.title) === catalog.releaseKey(it.title));
const cleanName = (t) => t.replace(/\s*-\s*(Single|EP)$/i, '');

async function renderPicker(query) {
  const box = $('#pk-results');
  box.innerHTML = '<p class="hint">Cargando…</p>';
  let list, all = [];
  try {
    if (query) list = await catalog.searchAlbums(query);
    else {
      all = await catalog.btsAlbums();
      const seen = new Set();
      list = all.filter((a) => (pkFilter === 'singles') === catalog.isSingle(a)).filter((a) => {
        const k = catalog.releaseKey(a.title);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  } catch {
    box.innerHTML = '<p class="hint">Necesitas internet para ver la discografía.</p>';
    return;
  }
  box.innerHTML = list.length ? '' : '<p class="hint">Sin resultados.</p>';
  list.forEach((it, i) => {
    const b = document.createElement('button');
    const have = owned(it);
    b.className = 'result' + (have ? ' owned' : '');
    b.style.animationDelay = `${Math.min(i, 24) * 20}ms`;
    b.innerHTML = '<img alt="" loading="lazy"><span class="rt"></span><span class="rm"></span>';
    b.querySelector('img').src = it.thumb;
    b.querySelector('.rt').textContent = cleanName(it.title);
    b.querySelector('.rm').textContent = have ? '✓ En tu colección' : `${query ? it.artist + ' · ' : ''}${it.year} · ${it.count} canc.`;
    // en la discografía, si una edición no trae canciones se prueba otra con el mismo nombre
    const editions = query ? [it] : [it, ...all.filter((x) => x !== it && catalog.releaseKey(x.title) === catalog.releaseKey(it.title))];
    b.onclick = () => (have ? toast('Ya está en tu colección.') : addFromCatalog(it, editions, b));
    box.appendChild(b);
  });
}

async function addFromCatalog(it, editions, btn) {
  btn.classList.add('loading');
  try {
    // si iTunes no publica sus canciones (pasa con algunos lanzamientos), se añade con portada y sin canciones
    const found = await catalog.fetchAlbum(editions) || { match: it, tracks: [], cover: await catalog.fetchBlob(it.art), empty: true };
    const a = {
      id: db.uid(), ...newAlbumTemplate(nextOrder()),
      title: cleanName(it.title), artist: it.artist, year: +it.year || '',
      cover: found.cover, tracks: found.tracks, itunesId: found.empty ? null : found.match.id,
    };
    await db.put('albums', serialize(a));
    await prepareAlbum(a);
    buildSleeve(a);
    albums.push(a);
    car.target = albums.length - 1;
    closeModal($('#picker'));
    toast(found.empty ? `"${a.title}" añadido. iTunes aún no tiene sus canciones: puedes ponerlas en "Editar".` : `"${a.title}" añadido a tu colección.`);
  } catch {
    btn.classList.remove('loading');
    toast('No se pudo descargar el álbum. Revisa la conexión.');
  }
}

$('#btn-add').addEventListener('click', () => {
  $('#pk-q').value = '';
  openModal($('#picker'));
  renderPicker();
});
document.querySelectorAll('#picker .tab').forEach((t) => t.addEventListener('click', () => {
  pkFilter = t.dataset.f;
  document.querySelectorAll('#picker .tab').forEach((x) => x.classList.toggle('sel', x === t));
  $('#pk-q').value = '';
  renderPicker();
}));
$('#pk-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#pk-q').value.trim();
  document.querySelectorAll('#picker .tab').forEach((x) => x.classList.toggle('sel', !q && x.dataset.f === pkFilter));
  renderPicker(q);
});
$('#pk-close').addEventListener('click', () => closeModal($('#picker')));
$('#pk-empty').addEventListener('click', () => {
  closeModal($('#picker'));
  const a = { id: db.uid(), ...newAlbumTemplate(nextOrder()) };
  openEditor(a, { isNew: true, onSave: (d) => saveAlbum(d, true) });
});

async function saveAlbum(draft, isNew = false) {
  if (isNew) {
    await db.put('albums', serialize(draft));
    await prepareAlbum(draft);
    buildSleeve(draft);
    albums.push(draft);
    car.target = albums.length - 1;
    updateLibInfo();
    toast('Álbum creado.');
    return;
  }
  const a = albums.find((x) => x.id === draft.id);
  if (!a) return;
  for (const k of ['title', 'artist', 'year', 'vinyl', 'cover', 'tracks', 'itunesId']) a[k] = draft[k];
  await db.put('albums', serialize(a));
  await prepareAlbum(a);
  refreshSleeve(a);
  vinylCache.delete(a.id);
  if (recAlbumId === a.id) setRecordAlbum(a);
  if (P.album === a) {
    const idx = a.tracks.findIndex((t) => t.id === loadedTrackId);
    if (idx >= 0) P.index = idx;
    else {
      if (P.state !== 'rest') await park();
      P.index = 0; loadedTrackId = null;
    }
    renderPlayer();
    updateMediaSession();
  }
  updateLibInfo();
  toast('Cambios guardados.');
}

async function deleteAlbum(a) {
  if (P.album === a && mode === 'player') await goLibrary();
  const i = albums.indexOf(a);
  if (i < 0) return;
  scene.remove(a._sleeve);
  disposeSleeve(a._sleeve);
  albums.splice(i, 1);
  vinylCache.delete(a.id);
  if (recAlbumId === a.id) recAlbumId = null;
  await db.del('albums', a.id);
  car.target = clamp(Math.round(car.target), 0, Math.max(0, albums.length - 1));
  car.scroll = Math.min(car.scroll, Math.max(0, albums.length - 1));
  lastCenter = -2;
  toast('Álbum eliminado.');
}

// Portadas y listas de canciones desde iTunes, para todos los álbumes que aún no las tienen.
let syncing = false;
async function syncCatalog({ auto = false } = {}) {
  if (syncing) return false;
  if (!navigator.onLine) { if (!auto) toast('Necesitas internet para descargar las portadas.'); return false; }
  const todo = albums.filter((a) => !a.itunesId && P.album !== a);
  if (!todo.length) { if (!auto) toast('Todos los álbumes ya tienen su portada y canciones.'); return true; }
  syncing = true;
  $('#btn-sync').classList.add('busy');
  let done = 0, missed = 0, failed = false;
  for (const a of todo) {
    toast(`Descargando portadas… ${done + missed + 1} de ${todo.length}`);
    try {
      const found = await catalog.fetchAlbum(await catalog.matchBtsAll(a.title, a.itunesHint));
      if (!found) { missed++; continue; }
      if (P.album === a || !albums.includes(a)) continue;
      await applyCatalog(a, found);
      done++;
    } catch {
      failed = true;
      break;
    }
  }
  syncing = false;
  $('#btn-sync').classList.remove('busy');
  lastCenter = -2;
  if (failed) toast('Se cortó la conexión con iTunes. Vuelve a tocar "Portadas" para continuar.');
  else {
    const n = (k) => `${k} ${k === 1 ? 'álbum' : 'álbumes'}`;
    toast(missed ? `Listo: ${n(done)} con portada y canciones; ${n(missed)} sin coincidencia (búscalos en "Editar").` : `Listo: ${n(done)} con portada y canciones.`);
  }
  return !failed;
}
$('#btn-sync').addEventListener('click', () => syncCatalog());

// ============================================================
// Bucle principal
// ============================================================
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
}
window.addEventListener('resize', onResize);

let last = performance.now(), uiAcc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  updateTweens(dt);
  updateCarousel(dt);
  updateDeck(dt);
  layoutObjects();
  updateCamera();
  renderer.render(scene, camera);
  uiAcc += dt;
  if (uiAcc > 0.25) { uiAcc = 0; if (mode === 'player') renderNowPlaying(); }
  requestAnimationFrame(frame);
}

async function start() {
  try {
    albums = await loadAlbums();
  } catch (e) {
    console.error(e);
    toast('No se pudo abrir el almacenamiento local; los cambios no se guardarán.');
    albums = DEFAULT_ALBUMS.map((a, i) => ({ id: 'bts-' + a.slug, title: a.title, artist: 'BTS', year: a.year, vinyl: a.vinyl, palette: a.palette, order: i, tracks: [], cover: null }));
  }
  for (const a of albums) { await prepareAlbum(a); buildSleeve(a); }
  if (albums[0]) setRecordAlbum(albums[0]);
  updateLibInfo();
  requestAnimationFrame((t) => { last = t; frame(t); });
  setTimeout(() => $('#loading').classList.add('done'), 150);
  // la primera vez, intenta traer las portadas reales automáticamente
  try {
    if (!(await db.get('meta', 'catalogAuto')) || addedDefaults) {
      await sleep(1200);
      if (await syncCatalog({ auto: true })) await db.put('meta', { key: 'catalogAuto', value: true });
    }
  } catch { /* sin almacenamiento */ }
}
start();

if ('serviceWorker' in navigator && window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// acceso para depurar desde la consola
window.__vinyl = { P, car, arm, albums: () => albums, enterPlayer, goLibrary };
