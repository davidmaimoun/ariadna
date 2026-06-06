import { useEffect, useRef, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import { useStore } from '../../store/useStore'
import ToolPage from '../../layout/ToolPage'
import SequenceToolbar from '../../components/toolbars/SequenceToolbar'
import SequenceCanvas    from '../../components/viewers/SequenceCanvas'
import SequenceTextPanel from '../../components/viewers/SequenceTextPanel'
import MiniMap           from '../../components/viewers/MiniMap'
import ContigSelector    from '../../components/viewers/ContigSelector'
import SequenceSidebar   from '../../components/sidebars/SequenceSidebar'
import SequenceHome from './SequenceHome'

function SequenceViewer({ doc, onClose }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w:900, h:500 })
  const [showText, setShowText] = useState(true)
  const [textH, setTextH] = useState(300)

  // Drag-to-resize the text panel
  const startDrag = (e) => {
    e.preventDefault()
    const startY = e.clientY, startH = textH
    const onMove = (ev) => setTextH(Math.max(120, Math.min(600, startH + (startY - ev.clientY))))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }
  const [activeContig, setActiveContig] = useState(doc.data.activeContig || 0)

  const seqs = doc.data.seqs
  const isMulti = seqs.length > 1

  // Load the active contig directly into the interactive store.
  // The FASTA was already parsed in SequenceHome, so no worker is needed here.
  useEffect(() => {
    const s   = seqs[activeContig]
    const seq = (s.seq || '').toUpperCase()
    const isProtein = /[EFILPQZ]/.test(seq.slice(0, 2000))
    const gc = seq.length ? ((seq.match(/[GC]/g) || []).length / seq.length) * 100 : 0
    useStore.getState().setSequenceMeta({
      id: s.id, description: '', length: seq.length,
      type: isProtein ? 'protein' : 'dna', format: 'fasta',
      gcContent: gc,
    })
    useStore.getState().setSequence(seq)
    useStore.getState().setViewport(0, Math.min(200, seq.length || 1))
    useStore.getState().setLoading(false, '', 100)
  }, [doc.id, activeContig])

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width>4&&r.height>4) setSize({ w:Math.floor(r.width), h:Math.floor(r.height) }) }
    measure(); const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [showText, textH])

  return (
    // position:absolute fills ToolPage's content area (position:relative) with a
    // definite height, so the flex:1 chain below resolves correctly
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <SequenceToolbar onClose={onClose}/>
      {isMulti && <ContigSelector contigs={seqs} active={activeContig} onSelect={setActiveContig}/>}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0, position:'relative' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          <div ref={containerRef} style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>
            <SequenceCanvas width={size.w} height={size.h}/>
            <MiniMap width={size.w}/>
          </div>
          {showText && (
            <div onMouseDown={startDrag}
              style={{ height:6, flexShrink:0, cursor:'row-resize', background:'var(--border2)', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--border2)'}/>
          )}
          {showText && (
            <div style={{ height:textH, flexShrink:0, overflow:'hidden' }}>
              <SequenceTextPanel height={textH} onToggle={() => setShowText(false)}/>
            </div>
          )}
        </div>
        <SequenceSidebar width={290}/>
      </div>
    </div>
  )
}

export default function SequencePage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.sequence)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'sequence')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('sequence', docId)
  }, [docId, doc, activeId])

  if (docId === 'new') return <SequenceHome/>
  if (!docId) {
    if (activeId) return <Navigate to={`/sequence/${activeId}`} replace/>
    return <SequenceHome/>
  }
  if (!doc) return <SequenceHome/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/sequence/${rest[rest.length-1].id}` : '/sequence')
  }

  return (
    <ToolPage tool="sequence" color="#1a56db" activeId={docId}>
      <SequenceViewer key={docId} doc={doc} onClose={close}/>
    </ToolPage>
  )
}