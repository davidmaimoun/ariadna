import { useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { collectLeaves } from '../../../utils/treeHelpers'

function renderLegendOnCanvas(ctx, meta, opts, nodeNames, legendPos) {
  const { metaField, nodeLabelField, leafColor='#1a56db' } = opts || {}
  const field = metaField || nodeLabelField
  if (!field || !meta || !nodeNames.length) return

  const groups = {}
  for (const name of nodeNames) {
    const val = meta[name]?.[field] || '—'
    if (!groups[val]) groups[val] = []
    groups[val].push(name)
  }
  const entries = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]))
  const colors  = d3.schemeTableau10

  const px = legendPos.x, py = legendPos.y
  const rowH = 20, pad = 10
  const w = 190, h = entries.length * rowH + pad * 2 + 28

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.beginPath(); ctx.roundRect?.(px,py,w,h,8) || ctx.rect(px,py,w,h); ctx.fill()
  ctx.strokeStyle = '#c0d0e8'; ctx.lineWidth = 1.5
  ctx.stroke()

  // Header
  ctx.fillStyle = '#eef3ff'
  ctx.beginPath(); ctx.roundRect?.(px,py,w,26,{upperLeft:8,upperRight:8}) || ctx.rect(px,py,w,26); ctx.fill()
  ctx.font = 'bold 10px "IBM Plex Sans",sans-serif'
  ctx.fillStyle = '#1a3faa'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(field.toUpperCase(), px+pad, py+13)

  // Entries
  entries.forEach(([val, nodes], i) => {
    const color = metaField ? colors[i % colors.length] : leafColor
    const ey    = py + 28 + i * rowH + rowH / 2
    ctx.beginPath()
    ctx.arc(px+pad+6, ey, 6, 0, Math.PI*2)
    ctx.fillStyle = color; ctx.fill()
    ctx.font = '11px "IBM Plex Sans",sans-serif'
    ctx.fillStyle = '#0f2460'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(val.length>20?val.slice(0,18)+'…':val, px+pad+16, ey)
    ctx.font = '10px monospace'; ctx.fillStyle = '#93b4f0'
    ctx.textAlign = 'right'
    ctx.fillText(nodes.length, px+w-pad, ey)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  DRAGGABLE LEGEND
// ─────────────────────────────────────────────────────────────────────────────
export default function TreeLegend({ meta, opts, graph, tree, onClose, pos={x:16,y:16}, setPos }) {
  // pos/setPos from parent so position is preserved across re-renders
  const dragRef = useRef(null)

  const { metaField, nodeLabelField, leafColor='#1a56db' } = opts || {}

  // Get node names from graph or tree
  const nodeNames = useMemo(() => {
    if (graph) return graph.nodes.map(n => n.name)
    if (tree)  return collectLeaves(tree).map(l => l.name)
    return []
  }, [graph, tree])

  // Build legend entries from metaField or nodeLabelField
  const entries = useMemo(() => {
    const field = metaField || nodeLabelField
    if (!field || !meta || !nodeNames.length) return []
    const groups = {}
    for (const name of nodeNames) {
      const val = meta[name]?.[field] || '—'
      if (!groups[val]) groups[val] = []
      groups[val].push(name)
    }
    const colors = d3.schemeTableau10
    return Object.entries(groups)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([val, nodes], i) => ({
        val, nodes,
        color: metaField ? colors[i % colors.length] : leafColor,
      }))
  }, [meta, metaField, nodeLabelField, nodeNames, leafColor])

  const field = metaField || nodeLabelField

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX-pos.x, startY: e.clientY-pos.y }
    const onMove = (e) => {
      if (!dragRef.current) return
      setPos?.({ x: e.clientX-dragRef.current.startX, y: e.clientY-dragRef.current.startY })
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!field || entries.length === 0) return null

  return (
    <div style={{
      position:'absolute', left:pos.x, top:pos.y, zIndex:20,
      background:'rgba(255,255,255,0.96)', borderRadius:10,
      border:'1.5px solid var(--border)', boxShadow:'0 4px 18px rgba(20,50,140,.13)',
      minWidth:180, maxWidth:260, userSelect:'none',
      backdropFilter:'blur(4px)',
    }}>
      {/* Header — drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'7px 10px 6px', cursor:'grab', borderBottom:'1px solid var(--border2)',
          background:'var(--bg2)', borderRadius:'8px 8px 0 0',
        }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--txt2)', textTransform:'uppercase', letterSpacing:'.05em' }}>
          ⋮⋮ {field}
        </span>
        <button onClick={onClose}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:15, lineHeight:1, padding:'0 2px' }}>×</button>
      </div>

      {/* Entries */}
      <div style={{ padding:'7px 10px', maxHeight:280, overflowY:'auto' }}>
        {entries.map(({ val, nodes, color }) => (
          <div key={val} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
            <div style={{ width:14, height:14, borderRadius:'50%', background:color, flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
            <span style={{ fontSize:12, color:'var(--txt)', flex:1, lineHeight:1.3 }}>{val}</span>
            <span style={{ fontSize:11, color:'var(--txt4)', fontFamily:'monospace', background:'var(--bg2)', padding:'1px 5px', borderRadius:8 }}>
              {nodes.length}
            </span>
          </div>
        ))}
      </div>

      {/* Footer — field name */}
      <div style={{ padding:'4px 10px 6px', fontSize:10, color:'var(--txt4)', borderTop:'1px solid var(--border2)' }}>
        {nodeNames.length} nodes · drag to move
      </div>
    </div>
  )
}

