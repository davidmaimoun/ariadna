import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from './store/useStore'
import SequenceCanvas from './components/SequenceCanvas'
import SequenceTextPanel from './components/SequenceTextPanel'
import TopBar from './components/TopBar'
import SidePanel from './components/SidePanel'
import MiniMap from './components/MiniMap'
import DropZone from './components/DropZone'
import Notification from './components/Notification'
import MSAViewer, { parseMSA } from './components/MSAViewer'
import VCFViewer, { parseVCF } from './components/VCFViewer'
import BAMViewer, { parseSAM } from './components/BAMViewer'
import BLASTViewer, { parseBlast } from './components/BLASTViewer'
import PhyloTree, { PhyloSidePanel } from './components/PhyloTree'
import { parseDistanceMatrix, parseNewick, buildMST } from './utils/phyloUtils'
import SangerViewer, { parseAB1 } from './components/SangerViewer'
import MatrixViewer, { parseMatrix } from './components/MatrixViewer'
import ContigSelector from './components/ContigSelector'
import ToolPicker from './components/ToolPicker'
import Footer from './components/Footer'
import { parseAnnotationFile } from './utils/bioUtils'

// ── Resizable panel ────────────────────────────────────────────────────────────
function useResize(initial, min, max, dir = 'v') {
  const [size, setSize] = useState(initial)
  const drag  = useRef(false)
  const start = useRef({ pos:0, size:initial })
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    drag.current  = true
    start.current = { pos: dir==='v' ? e.clientY : e.clientX, size }
    document.body.style.cursor     = dir==='v' ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (e) => {
      if (!drag.current) return
      const delta = dir==='v' ? start.current.pos-e.clientY : e.clientX-start.current.pos
      setSize(Math.max(min, Math.min(max, start.current.size+delta)))
    }
    const onUp = () => {
      drag.current = false
      document.body.style.cursor = document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [size, min, max, dir])
  return [size, onMouseDown]
}

function isMSA(seqs) {
  if (seqs.length < 2) return false
  const lens = new Set(seqs.map(s => s.seq.length))
  if (lens.size !== 1) return false
  const totalGaps = seqs.reduce((a,s) => a+(s.seq.match(/-/g)||[]).length, 0)
  return (totalGaps/(seqs.length*seqs[0].seq.length)) > 0.01
}

function countLeaves(node) {
  if (!node.children||!node.children.length) return 1
  return node.children.reduce((s,c) => s+countLeaves(c), 0)
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const workerRef    = useRef(null)
  const loadFileRef  = useRef(null)
  const containerRef = useRef(null)
  const [canvasSize,    setCanvasSize]    = useState({ w:800, h:400 })
  const [allContigs,    setAllContigs]    = useState([])
  const [activeContig,  setActiveContig]  = useState(0)
  const [isMultiFasta,  setIsMultiFasta]  = useState(false)
  const [msaSeqs,       setMsaSeqs]       = useState(null)
  const [vcfData,       setVcfData]       = useState(null)
  const [bamData,       setBamData]       = useState(null)
  const [blastData,     setBlastData]     = useState(null)
  const [phyloData,     setPhyloData]     = useState(null)
  const [sangerFiles,   setSangerFiles]   = useState([])
  const [matrixData,    setMatrixData]    = useState(null)
  const [showTextPanel, setShowTextPanel] = useState(true)
  const [toolPanel,     setToolPanel]     = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)  // null | 'sequence' | 'sanger' | 'matrix' | 'tree'

  // PhyloTree sidebar state (shared between PhyloTree and SidePanel)
  const [phyloOpts, setPhyloOpts] = useState({ nodeSize:7, fontSize:10.5, branchFontSize:8, lineColor:'#b8cfef', leafColor:'#1a56db', metaField:null, nodeLabelField:null })
  const [phyloMeta, setPhyloMeta] = useState(null)
  const [phyloHL,   setPhyloHL]   = useState(null)
  const [phyloAnnots,      setPhyloAnnots]      = useState([])
  const [phyloShowLegend,  setPhyloShowLegend]  = useState(false)
  const [phyloDrawMode,    setPhyloDrawMode]    = useState(false)
  const [phyloDrawShape,   setPhyloDrawShape]   = useState('ellipse')
  const [phyloDrawColor,   setPhyloDrawColor]   = useState('#1a56db')
  const [phyloDrawOpacity, setPhyloDrawOpacity] = useState(0.18)

  const [textPanelH, onTextDrag] = useResize(240, 80, 640, 'v')
  const [sidePanelW, onSideDrag] = useResize(310, 200, 560, 'h')
  const [sideCollapsed, setSideCollapsed] = useState(false)

  const { sequence, loading, loadingProgress, loadingMessage } = useStore()

  // Resize observer — always mounted
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setCanvasSize({ w:Math.floor(e.contentRect.width), h:Math.floor(e.contentRect.height) })
    )
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // Web Worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./workers/sequenceParser.worker.js', import.meta.url), { type:'module' }
    )
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data
      if (type==='PROGRESS') useStore.getState().setLoading(true, payload.message, payload.progress)
      if (type==='DONE') {
        const { meta, sequence:seq, annotations, sequenceIndex } = payload
        useStore.getState().setSequenceMeta(meta)
        useStore.getState().setSequence(seq)
        useStore.getState().setViewport(0, Math.min(200, meta.length))
        useStore.setState({ sequenceIndex })
        if (annotations?.length) useStore.getState().addAnnotations(annotations, 'GenBank features')
        useStore.getState().setLoading(false, '', 100)
        useStore.getState().notify(`Loaded ${meta.id} — ${meta.length.toLocaleString()} bp in ${meta.parseTime}s`, 'success')
      }
    }
    return () => workerRef.current?.terminate()
  }, [])

  // Stable setter refs — fixes stale closure in event listeners
  const setVcfDataRef   = useRef(setVcfData)
  const setBamDataRef   = useRef(setBamData)
  const setBlastDataRef = useRef(setBlastData)
  const setPhyloDataRef = useRef(setPhyloData)
  const setSangerRef    = useRef(setSangerFiles)
  const setMatrixRef    = useRef(setMatrixData)
  const setToolPanelRef = useRef(setToolPanel)
  useEffect(() => {
    setVcfDataRef.current   = setVcfData
    setBamDataRef.current   = setBamData
    setBlastDataRef.current = setBlastData
    setPhyloDataRef.current = setPhyloData
    setSangerRef.current    = setSangerFiles
    setMatrixRef.current    = setMatrixData
    setToolPanelRef.current = setToolPanel
  })

  // Tool-file event listeners
  useEffect(() => {
    const openTool = (name) => {
      // clear OTHER tools' data, not the one we're opening
      if (name !== 'vcf')    setVcfDataRef.current(null)
      if (name !== 'bam')    setBamDataRef.current(null)
      if (name !== 'blast')  setBlastDataRef.current(null)
      if (name !== 'sanger') setSangerRef.current([])
      if (name !== 'matrix') setMatrixRef.current(null)
      if (name !== 'phylo')  setPhyloDataRef.current(null)
      setToolPanelRef.current(name)
    }
    const onFASTA = (e) => {
      if (e.detail) {
        setActiveCategory(null)
        // treat same as normal file load
        loadFileRef.current?.(e.detail)
      }
    }
    const onVCF = async (e) => {
      const text = await e.detail.text()
      const data = parseVCF(text)
      setVcfDataRef.current(data); openTool('vcf')
      useStore.getState().notify(`VCF loaded — ${data.variants.length} variants`, 'success')
    }
    const onBAM = async (e) => {
      const file = e.detail
      const ext  = file.name.split('.').pop().toLowerCase()
      if (ext==='bam') {
        try {
          const fd = new FormData(); fd.append('file', file)
          const res = await fetch('/api/bam', { method:'POST', body:fd })
          if (res.ok) { setBamDataRef.current(parseSAM(await res.text())); openTool('bam'); return }
        } catch {}
        useStore.getState().notify('BAM: Flask backend not running. Convert: samtools view -h in.bam > out.sam', 'warning')
        return
      }
      const data = parseSAM(await file.text())
      setBamDataRef.current(data); openTool('bam')
      useStore.getState().notify(`SAM loaded — ${data.reads.length} reads`, 'success')
    }
    const onBLAST = async (e) => {
      const hits = parseBlast(await e.detail.text(), e.detail.name)
      setBlastDataRef.current(hits); openTool('blast')
      useStore.getState().notify(`BLAST loaded — ${hits.length} HSPs`, 'success')
    }
    const onPHYLO = () => {
      setPhyloDataRef.current(null)  // reset so PhyloTree shows selector
      setToolPanelRef.current('phylo')
    }
    const onSANGER = async (e) => {
      // File comes as ArrayBuffer via custom event
      const { name, buffer } = e.detail
      try {
        const data = parseAB1(buffer)
        setSangerRef.current([{ name, data }])
        openTool('sanger')
        useStore.getState().notify(`AB1 loaded — ${data.bases.length} bases`, 'success')
      } catch (err) {
        useStore.getState().notify('Could not parse AB1: ' + err.message, 'error')
      }
    }
    const onMATRIX = async (e) => {
      try {
        const text = await e.detail.text()
        const data = parseMatrix(text)
        setMatrixRef.current(data); openTool('matrix')
        useStore.getState().notify(`Matrix loaded — ${data.n} × ${data.nCols}`, 'success')
      } catch (err) {
        useStore.getState().notify('Could not parse matrix: ' + err.message, 'error')
      }
    }
    window.addEventListener('bv:openfasta',  onFASTA)
    window.addEventListener('bv:openvcf',    onVCF)
    window.addEventListener('bv:openbam',    onBAM)
    window.addEventListener('bv:openblast',  onBLAST)
    window.addEventListener('bv:openphylo',  onPHYLO)
    window.addEventListener('bv:opensanger', onSANGER)
    window.addEventListener('bv:openmatrix', onMATRIX)
    return () => {
      window.removeEventListener('bv:openfasta',  onFASTA)
    window.removeEventListener('bv:openvcf',    onVCF)
      window.removeEventListener('bv:openbam',    onBAM)
      window.removeEventListener('bv:openblast',  onBLAST)
      window.removeEventListener('bv:openphylo',  onPHYLO)
      window.removeEventListener('bv:opensanger', onSANGER)
      window.removeEventListener('bv:openmatrix', onMATRIX)
    }
  }, [])

  // Sequence loading
  const loadSingleSeq = useCallback((seqObj, filename) => {
    useStore.setState({ annotations:[], annotationFiles:[], selection:null, selectionText:'', editedSequence:null, history:[], historyIndex:-1 })
    useStore.getState().setLoading(true, 'Indexing…', 20)
    const blob = new Blob([`>${seqObj.id} ${seqObj.description||''}\n${seqObj.seq}`], { type:'text/plain' })
    workerRef.current.postMessage({ type:'PARSE_FILE', payload:{ file:new File([blob], filename||seqObj.id+'.fasta') } })
  }, [])

  const switchContig = useCallback((idx) => {
    setActiveContig(idx)
    if (allContigs[idx]) loadSingleSeq(allContigs[idx])
  }, [allContigs, loadSingleSeq])

  const loadFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()

    if (['gff','gff3','gtf','bed'].includes(ext)) {
      const features = parseAnnotationFile(await file.text(), file.name)
      useStore.getState().addAnnotations(features, file.name)
      useStore.getState().setLoading(false)
      useStore.getState().notify(`${features.length} features loaded`, 'success')
      return
    }

    // AB1 Sanger
    if (ext === 'ab1') {
      window.dispatchEvent(new CustomEvent('bv:opensanger', { detail:{ name:file.name, buffer:await file.arrayBuffer() } }))
      return
    }

    useStore.getState().setLoading(true, 'Reading file…', 5)
    const text = await file.text()
    const seqs  = parseMSA(text)

    if (seqs.length === 0) {
      useStore.getState().setLoading(false)
      useStore.getState().notify('No sequences found in file', 'error')
      return
    }

    if (isMSA(seqs)) {
      setMsaSeqs(seqs); setAllContigs([]); setIsMultiFasta(false)
      useStore.getState().setLoading(false)
      useStore.getState().notify(`MSA loaded — ${seqs.length} sequences × ${seqs[0].seq.length} columns`, 'success')
      return
    }

    if (seqs.length > 1) {
      setMsaSeqs(null); setIsMultiFasta(true); setAllContigs(seqs); setActiveContig(0)
      loadSingleSeq(seqs[0], file.name)
      useStore.getState().notify(`Multi-FASTA: ${seqs.length} sequences`, 'info')
      return
    }

    setMsaSeqs(null); setIsMultiFasta(false); setAllContigs([])
    loadSingleSeq(seqs[0], file.name)
  }, [loadSingleSeq])

  // Keep ref updated so event listeners can call loadFile
  useEffect(() => { loadFileRef.current = loadFile }, [loadFile])

  const handleFileInput = useCallback((e) => { loadFile(e.target.files[0]); e.target.value='' }, [loadFile])

  useEffect(() => {
    const onDrop     = (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]) }
    const onDragOver = (e) => e.preventDefault()
    window.addEventListener('drop', onDrop); window.addEventListener('dragover', onDragOver)
    return () => { window.removeEventListener('drop', onDrop); window.removeEventListener('dragover', onDragOver) }
  }, [loadFile])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return
      if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault(); useStore.getState().undo() }
      if ((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))) { e.preventDefault(); useStore.getState().redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeToolPanel = () => { setToolPanel(null); setActiveCategory(null) }
  const hasSeq = !!sequence

  // MSA full-screen
  if (msaSeqs) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)' }}>
      <TopBar onFileLoad={handleFileInput} activePanel={toolPanel} toolPanel={toolPanel} activeCategory={activeCategory} onOpenCategory={(cat) => { if(cat==='tree'){setActiveCategory(null);setToolPanel('phylo')}else{setActiveCategory(cat);if(cat!==null)setToolPanel(null)} }}/>
      <div style={{ flex:1, overflow:'hidden' }}>
        <MSAViewer sequences={msaSeqs} onClose={() => setMsaSeqs(null)} />
      </div>
      <Notification/>
    </div>
  )

  // Determine sidebar content

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>
      <TopBar onFileLoad={handleFileInput} activePanel={toolPanel} toolPanel={toolPanel} activeCategory={activeCategory} onOpenCategory={(cat) => { if(cat==='tree'){setActiveCategory(null);setToolPanel('phylo')}else{setActiveCategory(cat);if(cat!==null)setToolPanel(null)} }}/>

      {/* Contig selector */}
      {isMultiFasta && allContigs.length > 1 && (
        <ContigSelector contigs={allContigs} activeIndex={activeContig} onSelect={switchContig}/>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>

        {/* ToolPicker overlay — shown when category selected and no tool active */}
        {activeCategory && !toolPanel && (
          <div style={{ position:'absolute', inset:0, zIndex:30, display:'flex', flexDirection:'column' }}>
            <ToolPicker
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              onClose={() => setActiveCategory(null)}
              onOpenTree={() => { setActiveCategory(null); setToolPanel('phylo') }}
            />
          </div>
        )}

        {/* Main column */}
        <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0, position:'relative' }}>

          {/* Loading bar */}
          {loading && (
            <div style={{ padding:'7px 18px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              <div style={{ display:'flex', gap:5 }}>
                {[0,1,2].map(i=><div key={i} className="loading-dot" style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent)' }}/>)}
              </div>
              <span style={{ fontSize:13.5, color:'var(--txt2)', fontFamily:'"JetBrains Mono",monospace', fontWeight:500 }}>{loadingMessage}</span>
              <div style={{ flex:1, height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:loadingProgress+'%', height:'100%', background:'linear-gradient(90deg,var(--accent),var(--accent3))', borderRadius:3, transition:'width .25s' }}/>
              </div>
              <span style={{ fontSize:12, color:'var(--txt3)', fontFamily:'monospace', fontWeight:600 }}>{loadingProgress}%</span>
            </div>
          )}

          {/* Tool panel — takes flex:1 when active */}
          {toolPanel && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
              {toolPanel==='vcf'    && vcfData    && <VCFViewer   data={vcfData}    onClose={closeToolPanel}/>}
              {toolPanel==='bam'    && bamData    && <BAMViewer   data={bamData}    onClose={closeToolPanel} width={canvasSize.w} height={Math.max(400,canvasSize.h)}/>}
              {toolPanel==='blast'  && blastData  && <BLASTViewer data={blastData}  onClose={closeToolPanel} width={canvasSize.w}/>}
              {toolPanel==='phylo'  &&               <PhyloTree   data={null}  onClose={closeToolPanel} onDataChange={(d)=>setPhyloData(d)} opts={phyloOpts} setOpts={setPhyloOpts} meta={phyloMeta} setMeta={setPhyloMeta} highlight={phyloHL} setHighlight={setPhyloHL} onAnnotChange={setPhyloAnnots} drawMode={phyloDrawMode} setDrawMode={setPhyloDrawMode} drawShape={phyloDrawShape} setDrawShape={setPhyloDrawShape} drawColor={phyloDrawColor} setDrawColor={setPhyloDrawColor} drawOpacity={phyloDrawOpacity} setDrawOpacity={setPhyloDrawOpacity} showLegend={phyloShowLegend} setShowLegend={setPhyloShowLegend}/>}
              {toolPanel==='sanger' && <SangerViewer files={sangerFiles} onClose={closeToolPanel}/>}
              {toolPanel==='matrix' && matrixData && <MatrixViewer data={matrixData} onClose={closeToolPanel}/>}
            </div>
          )}

          {/* Sequence canvas — hidden but mounted when tool panel open (preserves ResizeObserver) */}
          <div ref={containerRef} style={{
            display: toolPanel ? 'none' : 'flex',
            flex:1, position:'relative', overflow:'hidden', minHeight:0, flexDirection:'column',
          }}>
            {hasSeq
              ? <SequenceCanvas width={canvasSize.w} height={canvasSize.h}/>
              : !loading && (activeCategory ? null : <DropZone onFile={loadFile}/>)
            }
            {/* Close sequence button */}
            {hasSeq && !toolPanel && (
              <button
                onClick={() => {
                  useStore.setState({ sequence:null, editedSequence:null, sequenceMeta:null, annotations:[], annotationFiles:[], selection:null, selectionText:'', history:[], historyIndex:-1, sequenceIndex:null })
                  setAllContigs([]); setIsMultiFasta(false); setActiveContig(0)
                }}
                title="Close sequence"
                style={{ position:'absolute', top:8, right:8, zIndex:10, width:28, height:28, borderRadius:'50%', border:'1.5px solid var(--border)', background:'rgba(255,255,255,0.9)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'var(--txt3)', boxShadow:'var(--shadow)' }}
              >✕</button>
            )}
            <TooltipOverlay/>
          </div>

          {hasSeq && !toolPanel && <MiniMap width={canvasSize.w}/>}

          {/* Full sequence text panel */}
          {hasSeq && !toolPanel && (
            <div style={{ flexShrink:0, background:'var(--panel)' }}>
              <div onMouseDown={onTextDrag} style={{
                display:'flex', alignItems:'center', gap:10, padding:'5px 16px',
                background:'var(--bg3)', cursor:'row-resize', userSelect:'none',
                borderTop:'2px solid var(--border)',
                borderBottom: showTextPanel?'1px solid var(--border2)':'none',
              }}>
                <svg width="18" height="10" viewBox="0 0 18 10" fill="var(--txt4)">
                  <rect y="0" width="18" height="2" rx="1"/>
                  <rect y="4" width="18" height="2" rx="1"/>
                  <rect y="8" width="18" height="2" rx="1"/>
                </svg>
                <span onClick={()=>setShowTextPanel(v=>!v)}
                  style={{ fontSize:13, fontWeight:700, color:'var(--txt2)', cursor:'pointer', letterSpacing:'-.2px' }}>
                  {showTextPanel?'▼':'▶'} Full Sequence
                </span>
                <span style={{ fontSize:11.5, color:'var(--txt4)' }}>
                  {sequence?.length?.toLocaleString()} bp · drag to resize
                </span>
              </div>
              {showTextPanel && <SequenceTextPanel height={textPanelH}/>}
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <button
            onClick={() => setSideCollapsed(c => !c)}
            title={sideCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              position:'absolute', left:-14, top:'50%', transform:'translateY(-50%)',
              zIndex:30, width:16, height:48, borderRadius:'4px 0 0 4px',
              background:'var(--bg3)', border:'1px solid var(--border)',
              borderRight:'none', cursor:'pointer', display:'flex',
              alignItems:'center', justifyContent:'center',
              color:'var(--txt3)', fontSize:10, padding:0,
              boxShadow:'-2px 0 6px rgba(0,0,0,0.06)',
            }}
          >{sideCollapsed ? '◀' : '▶'}</button>
        </div>

        {/* Resize handle */}
        {!sideCollapsed && toolPanel !== 'sanger' && (
          <div onMouseDown={onSideDrag}
            style={{ width:5, flexShrink:0, cursor:'col-resize', background:'var(--border2)', transition:'background .15s', zIndex:10 }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--accent)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--border2)'}
          />
        )}

        {/* Side panel — adapts to active tool */}
        {!sideCollapsed && (
          toolPanel === 'sanger'
            ? null  /* Sanger has its own sidebar built-in */
            : toolPanel === 'phylo'
              ? (
                <div style={{ width:sidePanelW, flexShrink:0, background:'var(--panel)', overflow:'hidden' }}>
                  <PhyloSidePanel
                    treeData={phyloData}
                    opts={phyloOpts} setOpts={setPhyloOpts}
                    meta={phyloMeta} setMeta={setPhyloMeta}
                    highlight={phyloHL} setHighlight={setPhyloHL}
                    annotGroups={phyloAnnots} setAnnotGroups={setPhyloAnnots}
                    drawMode={phyloDrawMode} setDrawMode={setPhyloDrawMode}
                    drawShape={phyloDrawShape} setDrawShape={setPhyloDrawShape}
                    drawColor={phyloDrawColor} setDrawColor={setPhyloDrawColor}
                    drawOpacity={phyloDrawOpacity} setDrawOpacity={setPhyloDrawOpacity}
                    showLegend={phyloShowLegend} setShowLegend={setPhyloShowLegend}
                  />
                </div>
              )
              : <SidePanel width={sidePanelW}/>
        )}
      </div>

      <Notification/>

      <Footer/>
    </div>
  )
}

function TooltipOverlay() {
  const { tooltip } = useStore()
  if (!tooltip) return null
  return <div className="tooltip" style={{ left:tooltip.x, top:tooltip.y }}>{tooltip.content}</div>
}