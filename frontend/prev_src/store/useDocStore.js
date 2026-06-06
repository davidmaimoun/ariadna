import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
//  useDocStore — manages open documents across all tools (tab system)
//
//  A "document" is one open file/instance:
//    { id, tool, name, data }
//
//  Multiple documents can be open per tool (tabs). Navigating between tools
//  never closes anything — data persists here until explicitly removed.
// ─────────────────────────────────────────────────────────────────────────────

let counter = 0
const nextId = (tool) => `${tool}_${Date.now()}_${++counter}`

export const useDocStore = create((set, get) => ({
  docs: [],                 // [{ id, tool, name, data }]
  activeByTool: {},         // { tree:'id', matrix:'id', sequence:'id', ... }

  // Create a document and make it active for its tool. Returns the new id.
  addDoc: (tool, name, data) => {
    const id = nextId(tool)
    set(s => ({
      docs: [...s.docs, { id, tool, name, data }],
      activeByTool: { ...s.activeByTool, [tool]: id },
    }))
    return id
  },

  // Remove a document; if it was active, fall back to another doc of same tool
  removeDoc: (id) => set(s => {
    const doc = s.docs.find(d => d.id === id)
    const docs = s.docs.filter(d => d.id !== id)
    const activeByTool = { ...s.activeByTool }
    if (doc && activeByTool[doc.tool] === id) {
      const siblings = docs.filter(d => d.tool === doc.tool)
      activeByTool[doc.tool] = siblings.length ? siblings[siblings.length - 1].id : null
    }
    return { docs, activeByTool }
  }),

  setActive: (tool, id) =>
    set(s => ({ activeByTool: { ...s.activeByTool, [tool]: id } })),

  updateDocData: (id, data) =>
    set(s => ({ docs: s.docs.map(d => d.id === id ? { ...d, data } : d) })),

  renameDoc: (id, name) =>
    set(s => ({ docs: s.docs.map(d => d.id === id ? { ...d, name } : d) })),

  // selectors (call via useDocStore(s => ...) or getState())
  getDoc:        (id)   => get().docs.find(d => d.id === id) || null,
  getDocsByTool: (tool) => get().docs.filter(d => d.tool === tool),
  getActiveId:   (tool) => get().activeByTool[tool] || null,
}))
