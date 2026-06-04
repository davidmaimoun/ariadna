import { useRef } from 'react'
import {
  Dna, Microscope, Grid3x3, GitBranch,
  Undo2, Redo2, Search, ZoomIn, ZoomOut,
  Maximize2, AlignCenter, Copy, Download,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { parseAnnotationFile, exportFASTA, exportGFF3 } from '../utils/bioUtils'

export default function TopBar({ onFileLoad, onOpenCategory, activeCategory, toolPanel }) {
  const annotRef = useRef()

  const {
    sequenceMeta, editedSequence, sequence, annotations,
    selection, selectionText, viewStart, viewEnd, zoomLevel,
    setViewport, zoomTo, jumpTo,
    addAnnotations, notify,
    searchQuery, searchResults, searchIndex,
    setSearch, setSearchResults,
    undo, redo, history, historyIndex,
  } = useStore()

  const seq  = editedSequence || sequence || ''
  const span = viewEnd - viewStart

  const handleSearch = (q) => {
    setSearch(q)
    if (!q || q.length < 2) return
    const results = []
    const upper = seq.toUpperCase(), pat = q.toUpperCase()
    let idx = 0
    while (idx < upper.length) {
      const f = upper.indexOf(pat, idx); if (f === -1) break
      results.push(f); idx = f + 1
    }
    setSearchResults(results)
    if (results.length) jumpTo(results[0])
    notify(`${results.length} match${results.length !== 1 ? 'es' : ''} found`)
  }
  const navSearch = (dir) => {
    if (!searchResults.length) return
    const ni = dir === 'next'
      ? (searchIndex + 1) % searchResults.length
      : (searchIndex - 1 + searchResults.length) % searchResults.length
    useStore.setState({ searchIndex: ni })
    jumpTo(searchResults[ni])
  }

  const handleAnnotFile = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const features = parseAnnotationFile(await file.text(), file.name)
    addAnnotations(features, file.name)
    notify(`${features.length} features loaded from ${file.name}`, 'success')
    e.target.value = ''
  }

  const exportFasta = () => {
    const content = exportFASTA(sequenceMeta, editedSequence || sequence)
    const name    = (sequenceMeta?.id || 'sequence') + '.fasta'
    dl(content, name, 'text/plain')
    notify('FASTA exported', 'success')
  }
  const exportGff = () => {
    dl(exportGFF3(annotations, sequenceMeta?.id), (sequenceMeta?.id || 'sequence') + '.gff3', 'text/plain')
    notify('GFF3 exported', 'success')
  }
  const copySeq = () => {
    if (!selectionText) return
    navigator.clipboard.writeText(selectionText)
    notify(`Copied ${selectionText.length} bp`, 'success')
  }
  const copyFasta = () => {
    if (!selectionText || !selection) return
    navigator.clipboard.writeText(`>${sequenceMeta?.id || 'seq'}_${selection.start + 1}_${selection.end + 1}\n${selectionText}`)
    notify('Copied as FASTA', 'success')
  }

  const div = <div style={{ width:1, height:28, background:'var(--border)', margin:'0 2px', flexShrink:0 }}/>

  // Category button style
  const catBtn = (id, icon, label, color) => {
    const isActive = activeCategory === id || toolPanel === id || (id === 'tree' && toolPanel === 'phylo')
    return (
      <button
        onClick={() => onOpenCategory(id)}
        style={{
          display:'flex', alignItems:'center', gap:7,
          padding:'6px 13px', borderRadius:8, border:'none', cursor:'pointer',
          fontSize:13, fontWeight:700, fontFamily:'"IBM Plex Sans",sans-serif',
          background: isActive ? color : 'transparent',
          color:       isActive ? '#fff' : '#3a5a9a',
          transition:'all .15s',
          boxShadow:   isActive ? `0 2px 10px ${color}44` : 'none',
        }}
        onMouseEnter={e => { if(!isActive){ e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='#0f2460' } }}
        onMouseLeave={e => { if(!isActive){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#3a5a9a' } }}
      >
        {icon} {label}
      </button>
    )
  }

  const hasSeq = !!sequence

  return (
    <header style={{
      display:'flex', alignItems:'center', gap:4, padding:'0 12px',
      height:54, flexShrink:0,
      background:'#ffffff',
      borderBottom:'1.5px solid var(--border)',
      boxShadow:'0 2px 10px rgba(20,50,140,.06)',
    }}>

      {/* ── Logo ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:4, flexShrink:0, cursor:'pointer' }}
        onClick={() => onOpenCategory(null)}>
        <svg viewBox="0 0 64 64" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2060f0"/><stop offset="100%" stopColor="#0a2fa8"/>
            </linearGradient>
            <linearGradient id="hs1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#90d0ff"/><stop offset="100%" stopColor="#4090ff"/>
            </linearGradient>
            <linearGradient id="hs2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffe84a"/><stop offset="100%" stopColor="#ffb200"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#hbg)"/>
          <path d="M18 6C18 6,46 16,46 32C46 48,18 58,18 58" stroke="url(#hs1)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <path d="M46 6C46 6,18 16,18 32C18 48,46 58,46 58" stroke="url(#hs2)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <line x1="20" y1="13" x2="44" y2="18" stroke="rgba(255,255,255,.65)" strokeWidth="2.8" strokeLinecap="round"/>
          <line x1="20" y1="30" x2="44" y2="30" stroke="rgba(255,255,255,.8)"  strokeWidth="2.8" strokeLinecap="round"/>
          <line x1="20" y1="47" x2="44" y2="52" stroke="rgba(255,255,255,.65)" strokeWidth="2.8" strokeLinecap="round"/>
        </svg>
        <div style={{ lineHeight:1.1 }}>
          <div style={{ fontSize:15, fontWeight:900, letterSpacing:'-.4px',
            background:'linear-gradient(90deg,#1a56db,#00c6ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Aria<span style={{ background:'linear-gradient(90deg,#1a9fff,#00e5ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>DNA</span>
          </div>
          <div style={{ fontSize:9, color:'var(--txt4)' }}>Genomic Viewer</div>
        </div>
      </div>

      {div}

      {/* ── Category navigation ────────────────────────────────── */}
      <nav style={{ display:'flex', alignItems:'center', gap:2 }}>
        {catBtn('sequence', <Dna     size={14}/>, 'Sequence', '#1a56db')}
        {catBtn('sanger',   <Microscope size={14}/>, 'Sanger', '#0a6e40')}
        {catBtn('matrix',   <Grid3x3  size={14}/>, 'Matrix',  '#cc7000')}
        {catBtn('tree',     <GitBranch size={14}/>, 'Tree',    '#6b40a8')}
      </nav>

      {div}

      {/* ── Annotations (only when sequence loaded) ───────────── */}
      {hasSeq && toolPanel === null && (
        <>
          <input ref={annotRef} type="file" accept=".gff,.gff3,.gtf,.bed" style={{ display:'none' }} onChange={handleAnnotFile}/>
          <button className="btn" style={{ fontSize:12, padding:'5px 11px' }}
            onClick={() => annotRef.current.click()} title="Add GFF3/BED/GTF annotations">
            <Plus size={13}/> Annot
          </button>
        </>
      )}

      {/* ── Undo/Redo ─────────────────────────────────────────── */}
      {hasSeq && (
        <>
          <button className="btn btn-ghost" onClick={undo} disabled={historyIndex < 0} title="Undo"><Undo2 size={14}/></button>
          <button className="btn btn-ghost" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><Redo2 size={14}/></button>
          {div}
        </>
      )}

      {/* ── Search (only when sequence in viewer) ─────────────── */}
      {hasSeq && toolPanel === null && (
        <>
          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
            <Search size={12} style={{ position:'absolute', left:8, color:'var(--txt4)', pointerEvents:'none' }}/>
            <input type="text" placeholder="Search motif…" value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && navSearch('next')}
              style={{ width:150, paddingLeft:26, fontSize:12 }}/>
          </div>
          {searchResults.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:11, color:'var(--txt3)', fontFamily:'monospace' }}>{searchIndex + 1}/{searchResults.length}</span>
              <button className="btn-zoom" onClick={() => navSearch('prev')} style={{ width:26, height:26, fontSize:13 }}><ChevronLeft size={14}/></button>
              <button className="btn-zoom" onClick={() => navSearch('next')} style={{ width:26, height:26, fontSize:13 }}><ChevronRight size={14}/></button>
            </div>
          )}
        </>
      )}

      {/* ── Viewport + zoom (only when sequence in viewer) ─────── */}
      {hasSeq && toolPanel === null && (
        <>
          {div}
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, fontFamily:'"JetBrains Mono",monospace', color:'var(--txt2)', flexShrink:0 }}>
            <span style={{ color:'var(--accent)', fontWeight:700 }}>{viewStart.toLocaleString()}–{viewEnd.toLocaleString()}</span>
            <span style={{ color:'var(--txt4)' }}>({fmtSpan(span)})</span>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button className="btn-zoom" onClick={() => zoomTo(null, 2)}   title="Zoom out" style={{ width:30, height:30 }}><ZoomOut size={15}/></button>
            <button className="btn-zoom" onClick={() => zoomTo(null, 0.5)} title="Zoom in"  style={{ width:30, height:30 }}><ZoomIn  size={15}/></button>
            <button className="btn" style={{ padding:'4px 9px', fontSize:11 }} onClick={() => setViewport(0, sequenceMeta?.length || 1000)}>
              <Maximize2 size={12}/> All
            </button>
            <button className="btn" style={{ padding:'4px 9px', fontSize:11 }}
              onClick={() => { const c = Math.round((viewStart + viewEnd) / 2); useStore.getState().setViewport(c - 50, c + 50) }}>
              <AlignCenter size={12}/> 1:1
            </button>
          </div>
        </>
      )}

      <div style={{ flex:1 }}/>

      {/* ── Selection actions ─────────────────────────────────── */}
      {selectionText && (
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:11.5, fontFamily:'monospace', color:'var(--txt2)', background:'var(--bg3)',
            padding:'3px 9px', borderRadius:20, border:'1.5px solid var(--border)', fontWeight:600 }}>
            {selectionText.length.toLocaleString()} bp
          </span>
          <button className="btn" style={{ padding:'5px 10px', fontSize:12 }} onClick={copySeq}><Copy size={12}/> Copy</button>
          <button className="btn" style={{ padding:'5px 10px', fontSize:12 }} onClick={copyFasta}><Dna  size={12}/> FASTA</button>
        </div>
      )}

      {/* ── Exports ──────────────────────────────────────────── */}
      {sequenceMeta && (
        <>
          {div}
          <button className="btn" style={{ padding:'5px 10px', fontSize:12 }} onClick={exportFasta}><Download size={12}/> FASTA</button>
          {annotations.length > 0 && (
            <button className="btn" style={{ padding:'5px 10px', fontSize:12 }} onClick={exportGff}><Download size={12}/> GFF3</button>
          )}
        </>
      )}
    </header>
  )
}

const fmtSpan = (n) => n >= 1e6 ? (n/1e6).toFixed(1)+' Mbp' : n >= 1e3 ? (n/1e3).toFixed(1)+' Kbp' : n+' bp'
const dl = (content, name, type) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name; a.click(); URL.revokeObjectURL(a.href)
}