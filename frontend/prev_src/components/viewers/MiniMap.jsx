import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from '../../store/useStore'

/*
  MiniMap — global sequence overview + navigation bar
  Top half:   GC density + annotation marks + viewport box  (click = jump)
  Bottom half: position slider bar for smooth navigation
  Scroll on canvas = zoom (replaces main canvas scroll for position)
*/

export default function MiniMap({ width }) {
  const canvasRef  = useRef()
  const isDragging = useRef(false)
  const MAP_H = 42

  const { sequence, editedSequence, sequenceMeta, viewStart, viewEnd, annotations, setViewport, zoomTo } = useStore()
  const seq    = editedSequence || sequence || ''
  const seqLen = sequenceMeta?.length || seq.length

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || !seqLen) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#f0f5ff'; ctx.fillRect(0, 0, width, MAP_H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, MAP_H - 1)

    const sampleN = Math.min(width * 2, seqLen)
    const step    = Math.max(1, Math.floor(seqLen / sampleN))
    const barW    = width / sampleN

    // GC density bars
    for (let i = 0; i < sampleN; i++) {
      const chunk = seq.slice(i * step, (i + 1) * step)
      if (!chunk) continue
      const gc = (chunk.match(/[GC]/gi) || []).length / chunk.length
      const bH = Math.round(gc * (MAP_H - 10))
      const hue = 215 + gc * 18
      ctx.fillStyle = `hsl(${hue},${58+gc*14}%,${58-gc*16}%)`
      ctx.fillRect(i * barW, MAP_H - 5 - bH, barW + .5, bH)
    }

    // Annotation marks
    for (const feat of annotations.slice(0, 500)) {
      const fx = (feat.start / seqLen) * width
      const fw = Math.max(1, ((feat.end - feat.start) / seqLen) * width)
      ctx.fillStyle = (feat.color || '#4a82e4') + 'cc'
      ctx.fillRect(fx, 2, fw, 5)
    }

    // Viewport indicator
    const vx = (viewStart / seqLen) * width
    const vw = Math.max(3, ((viewEnd - viewStart) / seqLen) * width)
    ctx.fillStyle = 'rgba(26,86,219,0.13)'; ctx.fillRect(vx, 0, vw, MAP_H)
    ctx.strokeStyle = '#1a56db'; ctx.lineWidth = 1.5
    ctx.strokeRect(vx + .75, .75, vw - 1.5, MAP_H - 1.5)

    ctx.setTransform(1,0,0,1,0,0)
  }, [seq, seqLen, viewStart, viewEnd, width, annotations])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr; canvas.height = MAP_H * dpr
    canvas.style.width = width + 'px'; canvas.style.height = MAP_H + 'px'
  }, [width])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const xToPos  = useCallback((x) => Math.round((x / width) * seqLen), [width, seqLen])

  const handleMouse = useCallback((e) => {
    if (!seqLen) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x    = e.clientX - rect.left
    if (e.type === 'mousedown') isDragging.current = true
    if (e.type === 'mouseup' || e.type === 'mouseleave') isDragging.current = false
    if (e.type === 'mousedown' || (e.type === 'mousemove' && e.buttons === 1)) {
      const center = xToPos(x)
      const span   = viewEnd - viewStart
      const ns     = Math.max(0, Math.min(center - Math.round(span / 2), seqLen - span))
      setViewport(ns, ns + span)
    }
  }, [seqLen, viewStart, viewEnd, xToPos, setViewport])

  // Scroll on minimap = zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    zoomTo(null, e.deltaY > 0 ? 1.5 : 0.67)
  }, [zoomTo])

  return (
    <div style={{ borderTop:'1.5px solid var(--border)', background:'var(--bg)', flexShrink:0 }}>
      {/* Overview canvas */}
      <div style={{ position:'relative' }}>
        <canvas ref={canvasRef} style={{ display:'block', cursor:'crosshair' }}
          onMouseDown={handleMouse} onMouseMove={handleMouse}
          onMouseUp={handleMouse} onMouseLeave={handleMouse}
          onWheel={handleWheel} />
        {seqLen > 0 && (
          <div style={{ position:'absolute', right:8, bottom:5, fontSize:10, color:'var(--txt4)', fontFamily:'"JetBrains Mono",monospace', pointerEvents:'none', background:'rgba(255,255,255,0.8)', padding:'1px 5px', borderRadius:4 }}>
            {((viewEnd - viewStart) / seqLen * 100).toFixed(2)}% visible
          </div>
        )}
      </div>

      {/* ── Navigation slider bar ──────────────────────────────────── */}
      {seqLen > 0 && (
        <div className="nav-bar-wrap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--txt4)"><path d="M8 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 8 1M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1H1.5A.5.5 0 0 1 1 8"/></svg>
          <span style={{ fontSize:11, color:'var(--txt4)', whiteSpace:'nowrap', fontFamily:'"JetBrains Mono",monospace' }}>
            {(viewStart+1).toLocaleString()}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, seqLen - (viewEnd - viewStart))}
            value={viewStart}
            onChange={e => {
              const ns = parseInt(e.target.value)
              setViewport(ns, ns + (viewEnd - viewStart))
            }}
            style={{ flex:1, accentColor:'var(--accent)', cursor:'pointer', height:5 }}
          />
          <span style={{ fontSize:11, color:'var(--txt4)', whiteSpace:'nowrap', fontFamily:'"JetBrains Mono",monospace' }}>
            {seqLen.toLocaleString()}
          </span>
          <span style={{ fontSize:11, fontWeight:600, color:'var(--txt2)', whiteSpace:'nowrap', fontFamily:'"JetBrains Mono",monospace' }}>
            {seqLen.toLocaleString()} bp
          </span>
        </div>
      )}
    </div>
  )
}
