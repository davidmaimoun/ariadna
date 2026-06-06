// Tiny IndexedDB key-value adapter for Zustand's persist middleware.
// Replaces localStorage (which is capped ~5-10 MB) with IndexedDB (GBs),
// so large genomic workspaces survive a page refresh without a backend.

const DB_NAME = 'ariadna'
const STORE   = 'kv'
const VERSION = 1

let _dbPromise = null
function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  return _dbPromise
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t  = db.transaction(STORE, mode)
    const st = t.objectStore(STORE)
    const r  = fn(st)
    t.oncomplete = () => resolve(r?.result)
    t.onerror    = () => reject(t.error)
    t.onabort    = () => reject(t.error)
  }))
}

// Shape required by zustand's createJSONStorage: string values
export const idbStorage = {
  getItem:    (name) => tx('readonly',  st => st.get(name)).then(v => v ?? null).catch(() => null),
  setItem:    (name, value) => tx('readwrite', st => st.put(value, name)).catch(e => { console.warn('[idb] save failed:', e?.message || e) }),
  removeItem: (name) => tx('readwrite', st => st.delete(name)).catch(() => {}),
}
