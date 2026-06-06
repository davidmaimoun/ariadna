import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── Sequence data ──
  sequence: null,        // Full sequence string (loaded on demand)
  sequenceMeta: null,   // { id, description, length, type, format }
  sequenceIndex: null,  // position index: Map<chunkIndex, offset>
  fileHandle: null,     // OPFS file handle for large files

  // ── Viewport ──
  viewStart: 0,
  viewEnd: 200,
  zoomLevel: 'nucleotide', // 'overview' | 'region' | 'nucleotide'

  // ── Selection ──
  selection: null,        // { start, end }
  selectionText: '',

  // ── Annotations ──
  annotations: [],        // Array of features
  annotationFiles: [],    // Loaded annotation file names
  visibleTracks: new Set(['gene', 'CDS', 'exon', 'mRNA', 'misc_feature']),

  // ── Edit history ──
  history: [],
  historyIndex: -1,
  editedSequence: null,   // null = no edits

  // ── UI state ──
  loading: false,
  loadingProgress: 0,
  loadingMessage: '',
  error: null,
  activePanel: 'info',   // 'info' | 'edit' | 'annotations' | 'analysis'
  showCoordinates: true,
  showComplement: false,
  showAminoAcids: false,
  showGCContent: true,
  tooltip: null,          // { x, y, content }
  searchQuery: '',
  searchResults: [],
  searchIndex: 0,
  notification: null,

  // ── Actions: sequence ──
  setSequenceMeta: (meta) => set({ sequenceMeta: meta }),
  setSequence: (seq) => set({ sequence: seq, editedSequence: null }),
  setFileHandle: (handle) => set({ fileHandle: handle }),
  setLoading: (loading, message = '', progress = 0) => set({ loading, loadingMessage: message, loadingProgress: progress }),
  setError: (error) => set({ error }),

  setViewport: (start, end) => {
    const len = get().sequenceMeta?.length || 1000
    const s = Math.max(0, Math.min(start, len - 1))
    const e = Math.min(len, Math.max(s + 1, end))
    const span = e - s
    let zoomLevel = 'nucleotide'
    if (span > 50000) zoomLevel = 'overview'
    else if (span > 500) zoomLevel = 'region'
    set({ viewStart: s, viewEnd: e, zoomLevel })
  },

  panBy: (delta) => {
    const { viewStart, viewEnd } = get()
    const len = get().sequenceMeta?.length || 1000
    const span = viewEnd - viewStart
    const ns = Math.max(0, Math.min(viewStart + delta, len - span))
    set({ viewStart: ns, viewEnd: ns + span })
  },

  zoomTo: (center, factor) => {
    const { viewStart, viewEnd } = get()
    const len = get().sequenceMeta?.length || 1000
    const span = viewEnd - viewStart
    const newSpan = Math.max(10, Math.min(len, Math.round(span * factor)))
    const c = center ?? Math.round((viewStart + viewEnd) / 2)
    const ns = Math.max(0, Math.min(c - Math.round(newSpan / 2), len - newSpan))
    get().setViewport(ns, ns + newSpan)
  },

  jumpTo: (pos) => {
    const { viewStart, viewEnd } = get()
    const span = viewEnd - viewStart
    get().setViewport(pos - Math.round(span / 2), pos + Math.round(span / 2))
  },

  // ── Selection ──
  setSelection: (sel) => {
    if (!sel) return set({ selection: null, selectionText: '' })
    const { sequence, editedSequence, viewStart } = get()
    const seq = editedSequence || sequence || ''
    const text = seq.slice(sel.start, sel.end + 1)
    set({ selection: sel, selectionText: text })
  },

  // ── Annotations ──
  addAnnotations: (features, filename) => set(state => ({
    annotations: [...state.annotations, ...features],
    annotationFiles: [...state.annotationFiles, filename],
  })),
  clearAnnotations: () => set({ annotations: [], annotationFiles: [] }),
  toggleTrack: (trackType) => set(state => {
    const t = new Set(state.visibleTracks)
    if (t.has(trackType)) t.delete(trackType); else t.add(trackType)
    return { visibleTracks: t }
  }),

  // ── Editing ──
  applyEdit: (type, payload) => {
    const { sequence, editedSequence, history, historyIndex } = get()
    const current = editedSequence || sequence || ''
    let next = current
    if (type === 'replace') {
      next = current.slice(0, payload.start) + payload.text + current.slice(payload.end + 1)
    } else if (type === 'insert') {
      next = current.slice(0, payload.pos) + payload.text + current.slice(payload.pos)
    } else if (type === 'delete') {
      next = current.slice(0, payload.start) + current.slice(payload.end + 1)
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ type, payload, before: current.slice(payload.start, (payload.end || payload.pos) + 1) })
    set({ editedSequence: next, history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex, editedSequence, sequence } = get()
    if (historyIndex < 0) return
    const entry = history[historyIndex]
    const current = editedSequence || sequence || ''
    let prev = current
    if (entry.type === 'replace') {
      prev = current.slice(0, entry.payload.start) + entry.before + current.slice(entry.payload.start + entry.payload.text.length)
    } else if (entry.type === 'insert') {
      prev = current.slice(0, entry.payload.pos) + current.slice(entry.payload.pos + entry.payload.text.length)
    } else if (entry.type === 'delete') {
      prev = current.slice(0, entry.payload.start) + entry.before + current.slice(entry.payload.start)
    }
    set({ editedSequence: historyIndex === 0 ? null : prev, historyIndex: historyIndex - 1 })
  },

  redo: () => {
    const { history, historyIndex, editedSequence, sequence } = get()
    if (historyIndex >= history.length - 1) return
    const entry = history[historyIndex + 1]
    const current = editedSequence || sequence || ''
    let next = current
    if (entry.type === 'replace') {
      next = current.slice(0, entry.payload.start) + entry.payload.text + current.slice(entry.payload.end + 1)
    } else if (entry.type === 'insert') {
      next = current.slice(0, entry.payload.pos) + entry.payload.text + current.slice(entry.payload.pos)
    } else if (entry.type === 'delete') {
      next = current.slice(0, entry.payload.start) + current.slice(entry.payload.end + 1)
    }
    set({ editedSequence: next, historyIndex: historyIndex + 1 })
  },

  // ── UI ──
  setTooltip: (tooltip) => set({ tooltip }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  toggleOption: (key) => set(state => ({ [key]: !state[key] })),
  setSearch: (q) => set({ searchQuery: q, searchResults: [], searchIndex: 0 }),
  setSearchResults: (results) => set({ searchResults: results, searchIndex: 0 }),
  nextSearchResult: () => set(state => ({ searchIndex: (state.searchIndex + 1) % state.searchResults.length })),
  prevSearchResult: () => set(state => ({ searchIndex: (state.searchIndex - 1 + state.searchResults.length) % state.searchResults.length })),
  notify: (msg, type = 'info') => {
    set({ notification: { msg, type } })
    setTimeout(() => set({ notification: null }), 3000)
  },
}))
