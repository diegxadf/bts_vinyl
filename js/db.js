// Almacenamiento local en la tablet (IndexedDB): álbumes, portadas y archivos de audio.
const DB_NAME = 'bts-vinyl';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

export async function getAll(store) {
  const db = await open();
  return req(db.transaction(store).objectStore(store).getAll());
}
export async function get(store, key) {
  const db = await open();
  return req(db.transaction(store).objectStore(store).get(key));
}
export async function put(store, value) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).put(value);
  return done(t);
}
export async function putMany(store, values) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  for (const v of values) s.put(v);
  return done(t);
}
export async function del(store, key) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(key);
  return done(t);
}
export async function delMany(store, keys) {
  if (!keys.length) return;
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  for (const k of keys) s.delete(k);
  return done(t);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
