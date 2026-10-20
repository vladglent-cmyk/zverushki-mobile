// Фото мамы, папы, бабушки и дедушки — только на этом телефоне (IndexedDB браузера).
// На сайт они не попадают: сайт публичный, поэтому семейные фото добавляются здесь, в настройках.

const MAX_PHOTOS = 6;
const SIZE = 600;   // фото уменьшаем до 600×600 — так быстро и не занимает много места

let dbPromise = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('zverushki-family', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idb(mode, op) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('photos', mode);
    const req = op(t.objectStore('photos'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

// { mama: [blob, …], papa: […] }
export async function loadFamilyPhotos(ids) {
  const out = {};
  try {
    for (const id of ids) {
      const list = await idb('readonly', (s) => s.get(id));
      if (list?.length) out[id] = list;
    }
  } catch {}
  return out;
}

// Квадрат по центру, 600×600, JPEG.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 3, side, side, 0, 0, SIZE, SIZE);
  bmp.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

export async function addPhotos(id, files) {
  const current = (await idb('readonly', (s) => s.get(id))) || [];
  for (const f of files) {
    if (current.length >= MAX_PHOTOS) break;
    try {
      const blob = await shrink(f);
      if (blob) current.push(blob);
    } catch {}
  }
  await idb('readwrite', (s) => s.put(current, id));
  return current.length;
}

export async function clearPhotos(id) {
  await idb('readwrite', (s) => s.delete(id));
}
