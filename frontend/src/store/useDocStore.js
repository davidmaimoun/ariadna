import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { idbStorage } from './idbStorage'

// ─────────────────────────────────────────────────────────────────────────────
//  useDocStore — open documents across all tools (tabs), persisted to IndexedDB
//
//  A document: { id, tool, name, data, createdAt, lastOpenedAt }
//  Data payloads are JSON-serializable so the workspace survives a refresh.
//
//  EVICTION POLICY (keeps IndexedDB from saturating):
//    • at most MAX_DOCS documents
//    • at most MAX_BYTES total serialized size
//  When exceeded, the least-recently-opened NON-active documents are dropped.
//  Currently-open documents are never evicted.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DOCS  = 10
const MAX_BYTES = 60 * 1024 * 1024   // ~60 MB client budget

// Session marker: sessionStorage survives refresh but NOT tab close.
// Absent marker => fresh session (tab was closed) => wipe the saved workspace.
const isNewSession = (() => {
  try {
    const fresh = !sessionStorage.getItem('ariadna-session')
    sessionStorage.setItem('ariadna-session', '1')
    return fresh
  } catch { return false }
})()

let counter = 0
const nextId = (tool) => `${tool}_${Date.now()}_${++counter}`
const now = () => Date.now()

const docBytes = (d) => { try { return JSON.stringify(d).length } catch { return 0 } }

// Returns a trimmed docs array respecting the budget; never drops active docs.
function enforceBudget(docs, activeByTool) {
  const activeIds = new Set(Object.values(activeByTool).filter(Boolean))
  let kept = [...docs]

  const evictOldest = () => {
    const victim = kept
      .filter(d => !activeIds.has(d.id))
      .sort((a, b) => (a.lastOpenedAt || 0) - (b.lastOpenedAt || 0))[0]
    if (!victim) return false
    kept = kept.filter(d => d.id !== victim.id)
    return true
  }

  while (kept.length > MAX_DOCS) { if (!evictOldest()) break }
  while (kept.reduce((n, d) => n + docBytes(d), 0) > MAX_BYTES) { if (!evictOldest()) break }
  return kept
}

export const useDocStore = create(persist((set, get) => ({
  docs: [],
  activeByTool: {},

  addDoc: (tool, name, data) => {
    const id  = nextId(tool)
    const doc = { id, tool, name, data, createdAt: now(), lastOpenedAt: now() }
    set(s => {
      const activeByTool = { ...s.activeByTool, [tool]: id }
      const docs = enforceBudget([...s.docs, doc], activeByTool)
      return { docs, activeByTool }
    })
    return id
  },

  removeDoc: (id) => set(s => {
    const doc  = s.docs.find(d => d.id === id)
    const docs = s.docs.filter(d => d.id !== id)
    const activeByTool = { ...s.activeByTool }
    if (doc && activeByTool[doc.tool] === id) {
      const siblings = docs.filter(d => d.tool === doc.tool)
      activeByTool[doc.tool] = siblings.length ? siblings[siblings.length-1].id : null
    }
    return { docs, activeByTool }
  }),

  setActive: (tool, id) => set(s => ({
    activeByTool: { ...s.activeByTool, [tool]: id },
    docs: s.docs.map(d => d.id === id ? { ...d, lastOpenedAt: now() } : d),
  })),

  updateDocData: (id, data) => set(s => ({ docs: s.docs.map(d => d.id === id ? { ...d, data } : d) })),
  renameDoc: (id, name)    => set(s => ({ docs: s.docs.map(d => d.id === id ? { ...d, name } : d) })),

  getDoc:        (id)   => get().docs.find(d => d.id === id) || null,
  getDocsByTool: (tool) => get().docs.filter(d => d.tool === tool),
  getActiveId:   (tool) => get().activeByTool[tool] || null,

  clearAll: () => set({ docs: [], activeByTool: {} }),
}), {
  name: 'ariadna-workspace',
  storage: createJSONStorage(() => idbStorage),
  partialize: (s) => ({ docs: s.docs, activeByTool: s.activeByTool }),
  onRehydrateStorage: () => (state, error) => {
    if (error) { console.warn('Workspace restore failed, starting fresh:', error); return }
    if (isNewSession && state) {
      // New browser session (the tab had been closed): start clean
      state.docs = []
      state.activeByTool = {}
      idbStorage.removeItem('ariadna-workspace')
    }
  },
}))

// Optional helper for a settings/“storage usage” UI later.
export async function getStorageEstimate() {
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota, pct: quota ? (usage / quota) * 100 : 0 }
  }
  return null
}