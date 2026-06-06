import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store/useStore'

// Higher contrast nucleotide colors on light background
const NUC_FG = { A:'#0a6e40', T:'#c0300e', G:'#1a3faa', C:'#8a5e00', U:'#c0300e', N:'#6a90c0', '-':'#9ab8e0', '.':'#9ab8e0' }
const NUC_BG = { A:'#d4f0de', T:'#fde0d0', G:'#d0e4ff', C:'#fff0c0', U:'#fde0d0', N:'#e8f0fb', '-':'#f0f5ff' }

const TRACK_LEFT = 110
const FEAT_H     = 16
const FEAT_GAP   = 3
const RULER_H    = 30
const SEQ_H      = 44
const COMP_H     = 26
const AA_H       = 20
const GC_H       = 44

export default function SequenceCanvas({ width, height }) {
  const canvasRef  = useRef(null)
  const animRef    = useRef(null)
  const isDragging = useRef(false)
  const selAnchor  = useRef(null)

  const {
    sequence, editedSequence, sequenceMeta,
    viewStart, viewEnd, zoomLevel,
    selection, annotations, visibleTracks,
    showComplement, showAminoAcids, showGCContent,
    setViewport, panBy, zoomTo, setSelection, setTooltip,
  } = useStore()

  const seq    = editedSequence || sequence || ''
  const seqLen = sequenceMeta?.length || seq.length

  const posToX = useCallback((pos) => {
    return TRACK_LEFT + ((pos - viewStart) / (viewEnd - viewStart)) * (width - TRACK_LEFT)
  }, [viewStart, viewEnd, width])

  const xToPos = useCallback((x) => {
    return Math.round(viewStart + ((x - TRACK_LEFT) / (width - TRACK_LEFT)) * (viewEnd - viewStart))
  }, [viewStart, viewEnd, width])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !seq) return
    const ctx    = canvas.getContext('2d')
    const dpr    = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const trackW  = width - TRACK_LEFT
    const span    = viewEnd - viewStart
    const bpPerPx = span / trackW
    const bpWidth = trackW / span

    ctx.fillStyle = '#f0f5ff'
    ctx.fillRect(0, 0, width, height)

    let y = 0

    // ── Ruler ──────────────────────────────────────────────────────────────
    ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, width, RULER_H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(TRACK_LEFT, y, trackW, RULER_H)
    ctx.strokeStyle = '#93b4f0'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(TRACK_LEFT, y); ctx.lineTo(TRACK_LEFT, y + RULER_H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, y + RULER_H); ctx.lineTo(width, y + RULER_H); ctx.stroke()

    const tickInterval = calcTickInterval(span, trackW)
    const firstTick    = Math.ceil(viewStart / tickInterval) * tickInterval
    ctx.font = '10px "JetBrains Mono",monospace'
    ctx.textBaseline = 'middle'
    for (let pos = firstTick; pos <= viewEnd; pos += tickInterval) {
      const x = posToX(pos)
      ctx.strokeStyle = '#93b4f0'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(x, y + RULER_H - 7); ctx.lineTo(x, y + RULER_H); ctx.stroke()
      ctx.fillStyle = '#2e50a0'; ctx.textAlign = 'center'
      ctx.fillText(formatPos(pos), x, y + RULER_H / 2)
    }
    ctx.fillStyle = '#2e50a0'; ctx.font = '10px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Tracks', TRACK_LEFT / 2, y + RULER_H / 2)
    y += RULER_H

    // ── Annotation tracks ──────────────────────────────────────────────────
    const visAnnot   = annotations.filter(f => visibleTracks.has(f.type) && f.end >= viewStart && f.start <= viewEnd)
    const trackTypes = [...new Set(visAnnot.map(f => f.type))]

    for (const ttype of trackTypes) {
      const feats = visAnnot.filter(f => f.type === ttype)
      const rowH  = FEAT_H + FEAT_GAP * 2
      ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, TRACK_LEFT, rowH)
      ctx.fillStyle = '#f8faff'; ctx.fillRect(TRACK_LEFT, y, trackW, rowH)
      ctx.fillStyle = '#1a3faa'; ctx.font = '10px "IBM Plex Sans",sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(ttype, TRACK_LEFT - 7, y + rowH / 2)

      for (const feat of feats) {
        const fx = posToX(feat.start)
        const fw = Math.max(2, posToX(feat.end + 1) - fx)
        const fy = y + FEAT_GAP
        const c  = feat.color || '#5a9e78'
        ctx.fillStyle = c + '28'; ctx.strokeStyle = c; ctx.lineWidth = 1.5
        roundRect(ctx, fx, fy, fw, FEAT_H, 4); ctx.fill(); ctx.stroke()
        if (fw > 22) {
          ctx.fillStyle = c
          const ax = feat.strand === 1 ? fx + fw - 7 : fx + 7
          const ay = fy + FEAT_H / 2
          ctx.beginPath()
          if (feat.strand === 1) { ctx.moveTo(ax,ay-4); ctx.lineTo(ax+6,ay); ctx.lineTo(ax,ay+4) }
          else                   { ctx.moveTo(ax,ay-4); ctx.lineTo(ax-6,ay); ctx.lineTo(ax,ay+4) }
          ctx.fill()
        }
        if (fw > 44) {
          const label = feat.qualifiers?.Name || feat.qualifiers?.gene || feat.id || feat.type
          ctx.fillStyle = c; ctx.font = '10px "IBM Plex Sans",sans-serif'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(truncate(ctx, label, fw - 14), fx + fw / 2, fy + FEAT_H / 2)
        }
      }
      sep(ctx, y + rowH, width); y += rowH
    }

    // ── GC track ──────────────────────────────────────────────────────────
    if (showGCContent && span < 50000) {
      ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, TRACK_LEFT, GC_H)
      ctx.fillStyle = '#f8faff'; ctx.fillRect(TRACK_LEFT, y, trackW, GC_H)
      ctx.fillStyle = '#1a3faa'; ctx.font = '10px "IBM Plex Sans",sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText('GC %', TRACK_LEFT - 7, y + GC_H / 2)

      const wSz = Math.max(10, Math.round(bpPerPx * 10))
      const stp = Math.max(1, Math.round(bpPerPx))
      const pts = []
      for (let pos = viewStart; pos < viewEnd; pos += stp) {
        const chunk = seq.slice(pos, pos + wSz).toUpperCase()
        if (!chunk) continue
        pts.push({ x: posToX(pos), gc: (chunk.match(/[GC]/g) || []).length / chunk.length })
      }
      if (pts.length > 1) {
        ctx.beginPath()
        ctx.moveTo(pts[0].x, y + GC_H - pts[0].gc * (GC_H - 6))
        for (const p of pts) ctx.lineTo(p.x, y + GC_H - p.gc * (GC_H - 6))
        ctx.lineTo(pts[pts.length-1].x, y + GC_H)
        ctx.lineTo(pts[0].x, y + GC_H)
        ctx.closePath()
        ctx.fillStyle = 'rgba(26,63,170,0.10)'; ctx.fill()
        ctx.beginPath()
        ctx.moveTo(pts[0].x, y + GC_H - pts[0].gc * (GC_H - 6))
        for (const p of pts) ctx.lineTo(p.x, y + GC_H - p.gc * (GC_H - 6))
        ctx.strokeStyle = '#e6a800'; ctx.lineWidth = 2; ctx.stroke()
      }
      ctx.setLineDash([3,4]); ctx.strokeStyle = '#93b4f0'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(TRACK_LEFT, y + GC_H/2); ctx.lineTo(width, y + GC_H/2); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#6b9e82'; ctx.font = '9px "JetBrains Mono",monospace'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('50%', TRACK_LEFT + 4, y + GC_H/2)
      sep(ctx, y + GC_H, width); y += GC_H
    }

    // ── Sequence track ─────────────────────────────────────────────────────
    const drawTrackBg = (h) => {
      ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, TRACK_LEFT, h)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(TRACK_LEFT, y, trackW, h)
    }
    const drawLabel = (label, h, color = '#1a3faa') => {
      ctx.fillStyle = color; ctx.font = '10px "IBM Plex Sans",sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(label, TRACK_LEFT - 7, y + h / 2)
    }

    if (zoomLevel === 'nucleotide') {
      drawTrackBg(SEQ_H); drawLabel("5'→3'", SEQ_H)

      if (bpPerPx <= 1) {
        const fs = Math.min(20, Math.max(9, bpWidth * 0.65))
        ctx.font = `700 ${fs}px "JetBrains Mono",monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        for (let pos = viewStart; pos < viewEnd; pos++) {
          const nuc = (seq[pos] || 'N').toUpperCase()
          const cx  = TRACK_LEFT + (pos - viewStart + 0.5) * bpWidth
          if (bpWidth >= 7) {
            ctx.fillStyle = NUC_BG[nuc] || '#e8f0fb'
            roundRect(ctx, cx - bpWidth/2 + 1, y + 5, bpWidth - 2, SEQ_H - 10, 4)
            ctx.fill()
          }
          if (bpWidth >= 11) {
            ctx.fillStyle = NUC_FG[nuc] || '#6a90c0'
            ctx.fillText(nuc, cx, y + SEQ_H / 2)
          } else if (bpWidth >= 4) {
            ctx.fillStyle = NUC_FG[nuc] || '#6a90c0'
            ctx.fillRect(cx - bpWidth/2 + 1, y + 7, bpWidth - 2, SEQ_H - 14)
          } else {
            ctx.fillStyle = NUC_FG[nuc] || '#6a90c0'
            ctx.fillRect(cx - bpWidth/2, y + 2, Math.max(1, bpWidth), SEQ_H - 4)
          }
        }
      } else {
        const stp = Math.max(1, Math.round(bpPerPx / 2))
        for (let pos = viewStart; pos < viewEnd; pos += stp) {
          const nuc = (seq[pos] || 'N').toUpperCase()
          ctx.fillStyle = NUC_FG[nuc] || '#6a90c0'
          ctx.fillRect(posToX(pos), y + 5, Math.max(1, bpWidth * stp - 0.5), SEQ_H - 10)
        }
      }
      sep(ctx, y + SEQ_H, width); y += SEQ_H

      // Complement
      if (showComplement) {
        const COMP = { A:'T', T:'A', G:'C', C:'G', U:'A', N:'N' }
        drawTrackBg(COMP_H); drawLabel("3'←5'", COMP_H, '#2e50a0')
        if (bpPerPx <= 1) {
          const fs = Math.min(14, Math.max(8, bpWidth * 0.58))
          ctx.font = `500 ${fs}px "JetBrains Mono",monospace`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          for (let pos = viewStart; pos < viewEnd; pos++) {
            const comp = COMP[(seq[pos]||'N').toUpperCase()] || 'N'
            const cx   = TRACK_LEFT + (pos - viewStart + 0.5) * bpWidth
            ctx.fillStyle = NUC_FG[comp] + 'aa'
            if (bpWidth >= 9) ctx.fillText(comp, cx, y + COMP_H / 2)
            else ctx.fillRect(cx - bpWidth/2 + 1, y + 5, Math.max(1, bpWidth - 2), COMP_H - 10)
          }
        }
        sep(ctx, y + COMP_H, width); y += COMP_H
      }

      // Amino acids (3 frames)
      if (showAminoAcids) {
        const COD = {TTT:'F',TTC:'F',TTA:'L',TTG:'L',CTT:'L',CTC:'L',CTA:'L',CTG:'L',ATT:'I',ATC:'I',ATA:'I',ATG:'M',GTT:'V',GTC:'V',GTA:'V',GTG:'V',TCT:'S',TCC:'S',TCA:'S',TCG:'S',CCT:'P',CCC:'P',CCA:'P',CCG:'P',ACT:'T',ACC:'T',ACA:'T',ACG:'T',GCT:'A',GCC:'A',GCA:'A',GCG:'A',TAT:'Y',TAC:'Y',TAA:'*',TAG:'*',CAT:'H',CAC:'H',CAA:'Q',CAG:'Q',AAT:'N',AAC:'N',AAA:'K',AAG:'K',GAT:'D',GAC:'D',GAA:'E',GAG:'E',TGT:'C',TGC:'C',TGA:'*',TGG:'W',CGT:'R',CGC:'R',CGA:'R',CGG:'R',AGT:'S',AGC:'S',AGA:'R',AGG:'R',GGT:'G',GGC:'G',GGA:'G',GGG:'G'}
        for (let frame = 0; frame < 3; frame++) {
          drawTrackBg(AA_H); drawLabel(`AA +${frame+1}`, AA_H, '#2e50a0')
          if (bpWidth >= 3) {
            const cs = Math.floor((viewStart - frame) / 3) * 3 + frame
            ctx.font = `${Math.min(12, bpWidth * 2.6)}px "JetBrains Mono",monospace`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            for (let pos = cs; pos < viewEnd - 2; pos += 3) {
              const aa = COD[seq.slice(pos,pos+3).toUpperCase()] || 'X'
              const cx = posToX(pos + 1.5)
              const cw = bpWidth * 3
              ctx.fillStyle = aa==='*'?'#fdecea':aa==='M'?'#d4f0de':'#ede8f9'
              ctx.fillRect(cx - cw/2, y + 2, cw - 1, AA_H - 4)
              if (bpWidth > 4) {
                ctx.fillStyle = aa==='*'?'#b34014':aa==='M'?'#0d6e32':'#5a3a9c'
                ctx.fillText(aa, cx, y + AA_H / 2)
              }
            }
          }
          sep(ctx, y + AA_H, width); y += AA_H
        }
      }

    } else if (zoomLevel === 'region') {
      drawTrackBg(SEQ_H); drawLabel('Sequence', SEQ_H)
      const stp = Math.max(1, Math.round(bpPerPx / 2))
      for (let pos = viewStart; pos < viewEnd; pos += stp) {
        const nuc = (seq[pos]||'N').toUpperCase()
        ctx.fillStyle = NUC_FG[nuc] || '#6a90c0'
        ctx.fillRect(posToX(pos), y + 7, Math.max(1, bpWidth * stp - 0.5), SEQ_H - 14)
      }
      sep(ctx, y + SEQ_H, width); y += SEQ_H

    } else {
      // Overview
      const OV = 60
      drawTrackBg(OV); drawLabel('Overview', OV)
      const stp = Math.max(1, Math.round(bpPerPx * 4))
      for (let pos = viewStart; pos < viewEnd; pos += stp) {
        const chunk = seq.slice(pos, pos + stp)
        const gc = chunk ? (chunk.match(/[GC]/gi)||[]).length / chunk.length : 0
        const bH = Math.round(gc * (OV - 8))
        ctx.fillStyle = `hsl(${132-gc*12},${55+gc*15}%,${60-gc*18}%)`
        ctx.fillRect(posToX(pos), y + OV - bH - 4, Math.max(1, bpWidth*stp-0.5), bH)
      }
      sep(ctx, y + OV, width); y += OV
    }

    // ── Selection overlay ──────────────────────────────────────────────────
    if (selection) {
      const sx = posToX(selection.start)
      const ex = posToX(selection.end + 1)
      ctx.fillStyle   = 'rgba(255,200,0,0.22)'
      ctx.fillRect(sx, RULER_H, ex - sx, y - RULER_H)
      ctx.strokeStyle = '#e6a800'; ctx.lineWidth = 2
      ctx.strokeRect(sx, RULER_H, ex - sx, y - RULER_H)
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [seq, viewStart, viewEnd, width, height, annotations, visibleTracks,
      selection, showComplement, showAminoAcids, showGCContent, zoomLevel, posToX])

  // Mouse events
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const pos  = xToPos(e.clientX - rect.left)
    isDragging.current = true; selAnchor.current = pos
    setSelection({ start:pos, end:pos })
  }, [xToPos, setSelection])

  const onMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x    = e.clientX - rect.left
    const pos  = Math.max(0, Math.min(xToPos(x), seqLen - 1))
    if (isDragging.current && e.buttons === 1 && selAnchor.current !== null) {
      const a = selAnchor.current
      setSelection({ start:Math.min(a,pos), end:Math.max(a,pos) })
    }
    const nuc = seq[pos]
    if (nuc && x > TRACK_LEFT)
      setTooltip({ x:e.clientX+14, y:e.clientY-12, content:`pos ${(pos+1).toLocaleString()} · ${nuc.toUpperCase()} · ${zoomLevel}` })
    else setTooltip(null)
  }, [xToPos, seqLen, seq, setSelection, setTooltip, zoomLevel])

  const onMouseUp    = useCallback(() => { isDragging.current = false }, [])
  const onMouseLeave = useCallback(() => { isDragging.current = false; setTooltip(null) }, [setTooltip])

  // Wheel zoom — attached as a NON-passive native listener so preventDefault works.
  // React's onWheel is passive by default and cannot preventDefault.
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const handler = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const pos  = xToPos(e.clientX - rect.left)
      zoomTo(pos, e.deltaY > 0 ? 1.5 : 0.67)
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [xToPos, zoomTo])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const span = viewEnd - viewStart
      if (e.key === 'ArrowLeft')       panBy(-Math.round(span * 0.1))
      if (e.key === 'ArrowRight')      panBy( Math.round(span * 0.1))
      if (e.key === '+' || e.key === '=') zoomTo(null, 0.5)
      if (e.key === '-')               zoomTo(null, 2)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewStart, viewEnd, panBy, zoomTo])

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr; canvas.height = height * dpr
    canvas.style.width = width+'px'; canvas.style.height = height+'px'
  }, [width, height])

  return (
    <canvas ref={canvasRef} style={{ cursor:'crosshair', display:'block' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} />
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r)
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h)
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r)
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath()
}
function sep(ctx, y, width) {
  ctx.strokeStyle = '#c0d4f5'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke()
}
function calcTickInterval(span, width) {
  const raw = span / Math.floor(width / 80)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const n of [1,2,5,10]) if (raw <= n * mag) return n * mag
  return mag * 10
}
function formatPos(pos) {
  if (pos >= 1e6) return (pos/1e6).toFixed(1)+'M'
  if (pos >= 1e3) return (pos/1e3).toFixed(0)+'K'
  return String(pos)
}
function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  for (let i = text.length-1; i > 0; i--) {
    const t = text.slice(0,i)+'…'
    if (ctx.measureText(t).width <= maxW) return t
  }
  return ''
}
