import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { GitBranch } from 'lucide-react'

// Sub-components
import RectTree        from './phylo/RectTree'
import CircularTree    from './phylo/CircularTree'
import ForceGraph      from './phylo/ForceGraph'
import DrawOverlay     from './phylo/DrawOverlay'
import TreeLegend      from './phylo/TreeLegend'
import AlgoSelector    from './phylo/AlgoSelector'
import PhyloSidePanelComp from './phylo/PhyloSidePanel'

// Utilities
import { collectLeaves, treeStats } from '../../utils/treeHelpers'

// Re-exports
export { default as PhyloSidePanel } from './phylo/PhyloSidePanel'

import PhyloToolbar   from '../toolbars/PhyloToolbar'
import PhyloSidebar   from '../sidebars/PhyloSidebar'

// Algorithms
import { mstKruskal, mstPrim, goeburst, neighborJoining, upgma } from '../../utils/treeAlgorithms'
import { parseNewick, parseDistanceMatrix, buildMST } from '../../utils/phyloUtils'

export default function PhyloTree({ data, onClose, autoLoad, onAutoLoaded }) {
  const containerRef = useRef()
  const [size,       setSize]       = useState({ w:900, h:600 })
  const [mode,       setMode]       = useState(null)
  // ── Internal state (was in App.jsx) ──────────────────────────────────────
  const [highlight,   setHighlight]   = useState(null)
  const [meta,        setMeta]        = useState(null)
  const [opts, setOpts] = useState({ nodeSize:7, fontSize:10.5, branchFontSize:8, lineColor:'#b8cfef', leafColor:'#1a56db', metaField:null })
  const [annotGroups,  setAnnotGroups]  = useState([])
  const [showLegendI,  setShowLegendI]  = useState(false)
  const [legendPos,    setLegendPos]    = useState({ x:16, y:16 })
  const showLegend    = showLegendI
  const setShowLegend  = setShowLegendI
  const [drawMode,    setDrawMode]    = useState(false)
  const [drawShape,   setDrawShape]   = useState('ellipse')
  const [drawColor,   setDrawColor]   = useState('#1a56db')
  const [drawOpacity, setDrawOpacity] = useState(0.18)
  const [loading,    setLoading]    = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingPct, setLoadingPct] = useState(0)
  const [treeData,   setTreeData]   = useState(data||null)

  const handleSelectRef = useRef(null)              // points to latest handleSelect
  const setAnnotGroupsAndNotify = setAnnotGroups    // plain setter alias

  // Auto-load when the autoLoad prop arrives (from the tool's Home picker)
  useEffect(() => {
    if (!autoLoad) return
    const { algoId, file } = autoLoad
    const type = algoId === 'nwk' ? 'newick' : 'matrix'
    const t = setTimeout(() => {
      handleSelectRef.current?.(algoId, file, type)
        .then(() => onAutoLoaded?.())
        .catch(console.error)
    }, 50)
    return () => clearTimeout(t)
  }, [autoLoad])

  const { tree, graph, filename, algo } = treeData||{}

  useEffect(() => {
    if (!treeData) return
    if (treeData.tree && !mode) setMode(treeData.algo==='upgma'||treeData.algo==='nj'?'rect':treeData.algo?.startsWith('mst')?'force':'rect')
    else if (treeData.graph && !mode) setMode('force')
  }, [treeData])

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(([e])=>setSize({ w:Math.floor(e.contentRect.width), h:Math.floor(e.contentRect.height) }))
    ro.observe(el); return ()=>ro.disconnect()
  }, [])

  const handleSelect = async (algoId, file, type) => {
    setLoading(true); setLoadingMsg('Reading file…'); setLoadingPct(10)
    try {
      const text = await file.text()
      if (type==='newick') {
        const t = parseNewick(text)
        if (!t) throw new Error('Could not parse Newick')
        setTreeData({ tree:t, graph:null, filename:file.name, algo:'newick' })
        setMode('rect')
      } else {
        setLoadingMsg('Parsing matrix…'); setLoadingPct(30)
        await new Promise(r=>setTimeout(r,0))
        const dm = parseDistanceMatrix(text)
        setLoadingMsg(`Running ${algoId.toUpperCase()}…`); setLoadingPct(60)
        await new Promise(r=>setTimeout(r,0))

        if (algoId==='nj'||algoId==='upgma') {
          const t = algoId==='nj' ? neighborJoining(dm.labels, dm.matrix) : upgma(dm.labels, dm.matrix)
          const newData = { tree:t, graph:null, filename:file.name, algo:algoId, isAllelic:dm.isAllelic }
          setTreeData(newData)
          setMode('rect')
        } else {
          let g
          if (algoId==='goeburst') g = goeburst(dm.labels, dm.profiles||dm.matrix)
          else if (algoId==='mst-prim') g = mstPrim(dm.labels, dm.matrix)
          else g = mstKruskal(dm.labels, dm.matrix)
          const newData2 = { tree:null, graph:g, filename:file.name, algo:algoId, isAllelic:dm.isAllelic }
          setTreeData(newData2)
          setMode('force')
        }
        setLoadingPct(100)
      }
    } catch (err) {
      alert('Error: '+err.message)
    } finally {
      setLoading(false); setLoadingMsg(''); setLoadingPct(0)
    }
  }

  // Keep ref pointing to handleSelect — must be AFTER its definition
  handleSelectRef.current = handleSelect

  const handleLeafClick = (name) => setHighlight(h=>h===name?null:name)

  const exportPNG = () => {
    const container = containerRef.current
    const name = (filename?.replace(/\.[^.]+$/,'')||'tree')+'.png'
    if (!container) return

    const canvas  = container.querySelector('canvas')
    // The first SVG is the visual overlay (position:absolute, zIndex:10)
    const allSvgs = Array.from(container.querySelectorAll('svg'))
    const overlays = allSvgs.filter(s=>s.style.position==='absolute')
    const mainSvg  = canvas ? null : allSvgs.find(s=>s.style.position!=='absolute')

    // Merge all SVG overlays into one SVG string for export
    const buildOverlaySVG = (W, H) => {
      const merged = document.createElementNS('http://www.w3.org/2000/svg','svg')
      merged.setAttribute('xmlns','http://www.w3.org/2000/svg')
      merged.setAttribute('width',W); merged.setAttribute('height',H)
      overlays.forEach(svg => {
        if (!svg.querySelectorAll('*').length) return
        const g = document.createElementNS('http://www.w3.org/2000/svg','g')
        Array.from(svg.children).forEach(c=>g.appendChild(c.cloneNode(true)))
        merged.appendChild(g)
      })
      return merged.children.length ? new XMLSerializer().serializeToString(merged) : null
    }

    const drawLegendIfNeeded = (cv, cssW, cssH) => {
      if (!showLegend || !meta) return
      const nodeNames = graph ? graph.nodes.map(n=>n.name) : tree ? collectLeaves(tree).map(l=>l.name) : []
      if (!nodeNames.length) return
      const ctx2 = cv.getContext('2d')
      const scaleX = cv.width / cssW, scaleY = cv.height / cssH
      ctx2.save(); ctx2.scale(scaleX, scaleY)
      renderLegendOnCanvas(ctx2, meta, opts, nodeNames, legendPos)
      ctx2.restore()
    }

    const composite = (baseCanvas, cssW, cssH) => {
      // Output at CSS pixel size (not DPR-scaled) so overlay aligns perfectly
      const out = document.createElement('canvas')
      out.width=cssW; out.height=cssH
      const ctx=out.getContext('2d')
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,cssW,cssH)
      // Draw source canvas scaled down to CSS size
      ctx.drawImage(baseCanvas, 0, 0, cssW, cssH)

      const svgStr = buildOverlaySVG(cssW, cssH)
      if (!svgStr) {
        drawLegendIfNeeded(out, cssW, cssH); const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download=name; a.click()
        return
      }
      const img=new Image()
      const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'}))
      img.onload=()=>{
        ctx.drawImage(img,0,0,cssW,cssH)
        URL.revokeObjectURL(url)
        drawLegendIfNeeded(out, cssW, cssH)  // draw legend
        const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download=name; a.click()
      }
      img.onerror=()=>{ URL.revokeObjectURL(url); const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download=name; a.click() }
      img.src=url
    }

    if (canvas) {
      // canvas.width/height are in physical pixels; clientWidth/Height are CSS pixels
      composite(canvas, canvas.clientWidth||size.w, canvas.clientHeight||canvasH)
    } else if (mainSvg) {
      const W=mainSvg.clientWidth||size.w, H=mainSvg.clientHeight||canvasH
      const cv=document.createElement('canvas'); cv.width=W*2; cv.height=H*2
      const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W*2,H*2)
      const svgStr=new XMLSerializer().serializeToString(mainSvg)
      const img=new Image()
      const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'}))
      img.onload=()=>{
        ctx.drawImage(img,0,0,W*2,H*2); URL.revokeObjectURL(url)
        composite(cv, W, H)
      }
      img.src=url
    }
  }

  const canvasH = Math.max(300, size.h-60)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)' }}>
      {/* Header */}
      <PhyloToolbar
        onClose={onClose}
        mode={mode} setMode={setMode}
        hasTree={!!tree} hasGraph={!!graph}
        drawMode={drawMode} setDrawMode={setDrawMode}
        onExportPNG={exportPNG}
        filename={treeData ? (filename||treeData?.algo?.toUpperCase()||'Tree') : null}
        algoLabel={treeData?.algo?.toUpperCase()}
        isAllelic={treeData?.isAllelic}
        onReset={() => { setTreeData(null); setMode(null); setHighlight(null) }}
      />

      {/* Body + sidebar */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div ref={containerRef} style={{ flex:1, overflow:'auto', background:'#fff', position:'relative' }}>
          {!treeData ? (
            <AlgoSelector onSelect={handleSelect} loading={loading} loadingMsg={loadingMsg} loadingPct={loadingPct}/>
          ) : (
            <div style={{ position:'relative', width:'100%', height:'100%' }}>
              {mode==='rect' && tree && (
                <RectTree root={tree} width={size.w} height={Math.max(canvasH, collectLeaves(tree).length*20+50)}
                  highlight={highlight} onLeafClick={handleLeafClick} opts={opts}/>
              )}
              {mode==='circular' && tree && (
                <CircularTree root={tree} width={Math.min(size.w,canvasH+80)} height={Math.min(size.w,canvasH+80)}
                  highlight={highlight} onLeafClick={handleLeafClick} opts={opts}/>
              )}
              {mode==='force' && graph && (
                <ForceGraph graph={graph} width={size.w} height={Math.max(canvasH,500)}
                  highlight={highlight} onNodeClick={handleLeafClick} meta={meta} opts={opts}/>
              )}
              {showLegend && (
                <TreeLegend
                  meta={meta} opts={opts}
                  graph={graph} tree={tree}
                  pos={legendPos} setPos={setLegendPos}
                  onClose={() => setShowLegend(false)}
                />
              )}
              <DrawOverlay
                width={size.w} height={Math.max(canvasH, mode==='rect'&&tree ? collectLeaves(tree).length*20+50 : 500)}
                shapes={annotGroups} setShapes={setAnnotGroupsAndNotify}
                drawMode={drawMode} drawShape={drawShape}
                activeColor={drawColor} opacity={drawOpacity}
              />
            </div>
          )}
        </div>
        <PhyloSidebar
          treeData={treeData} opts={opts} setOpts={setOpts}
          meta={meta} setMeta={setMeta}
          highlight={highlight} setHighlight={setHighlight}
          annotGroups={annotGroups} setAnnotGroups={setAnnotGroups}
          drawMode={drawMode} setDrawMode={setDrawMode}
          drawShape={drawShape} setDrawShape={setDrawShape}
          drawColor={drawColor} setDrawColor={setDrawColor}
          drawOpacity={drawOpacity} setDrawOpacity={setDrawOpacity}
          showLegend={showLegend} setShowLegend={setShowLegend}
        />
      </div>
    </div>
  )
}