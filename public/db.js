// IndexedDB 封裝：meta 存文字資料（一筆 state），photos 存照片 Blob
const DB_NAME = 'lifey';
const DB_VERSION = 1;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('meta');
        db.createObjectStore('photos', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

export const getMeta = (key) => run('meta', 'readonly', (s) => s.get(key));
export const putMeta = (key, value) => run('meta', 'readwrite', (s) => s.put(value, key));

export const getPhoto = (id) => run('photos', 'readonly', (s) => s.get(id));
export const getAllPhotos = () => run('photos', 'readonly', (s) => s.getAll());
export const getAllPhotoIds = () => run('photos', 'readonly', (s) => s.getAllKeys());
export const putPhotos = (photos) => run('photos', 'readwrite', (s) => { photos.forEach((p) => s.put(p)); });
export const deletePhotos = (ids) => run('photos', 'readwrite', (s) => { ids.forEach((id) => s.delete(id)); });

export async function clearAll() {
  await run('meta', 'readwrite', (s) => s.clear());
  await run('photos', 'readwrite', (s) => s.clear());
}
