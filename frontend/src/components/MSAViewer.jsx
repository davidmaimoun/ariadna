import { useRef, useEffect, useCallback, useState, useMemo } from 'react'

/*
  MSAViewer — Multiple Sequence Alignment viewer
  Accepte un fichier FASTA multiple aligné (.afa, .aln, .fa, .fasta avec plusieurs séquences de même longueur)
  Affiche : consensus, conservation colonne par colonne, séquences alignées avec gaps colorés
*/

const NUC_COLORS = { A:'#1a7a40', T:'#c05a1f', G:'#2563a8', C:'#9a7c10', U:'#c05a1f', N:'#9dbfad', '-':'#d4eadb', '.':'#d4eadb', X:'#9dbfad' }
const NUC_BG     = { A:'#e6f5ec', T:'#faeee6', G:'#e8eff9', C:'#f7f2e0', U:'#faeee6', N:'#f0f7f2', '-':'#fafcfb', '.':'#fafcfb' }
const AA_COLORS  = { A:'#1a7a40',R:'#2563a8',N:'#0e8c6e',D:'#c0392b',C:'#c05a1f',Q:'#0e8c6e',E:'#c0392b',G:'#6b9e82',H:'#2563a8',I:'#9a7c10',L:'#9a7c10',K:'#2563a8',M:'#9a7c10',F:'#6b40a8',P:'#c05a1f',S:'#1a7a40',T:'#1a7a40',W:'#6b40a8',Y:'#6b40a8',V:'#9a7c10','*':'#c0392b','-':'#d4eadb','X':'#9dbfad' }

const LABEL_W  = 160
const ROW_H    = 22
const RULER_H  = 24
const CONS_H   = 30  // conservation track height

function parseMSA(text) {
  const seqs = []
  let cur = null
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('>')) {
      if (cur) seqs.push(cur)
      cur = { id: t.slice(1).split(/\s+/)[0], desc: t.slice(1), seq: '' }
    } else if (cur) {
      cur.seq += t.toUpperCase()
    }
  }
  if (cur) seqs.push(cur)
  return seqs
}

function detectMSAType(seqs) {
  if (!seqs.length) return 'unknown'
  const sample = seqs[0].seq.replace(/-/g, '').slice(0, 100)
  const hasProtein = /[EFILPQZ]/.test(sample)
  if (hasProtein) return 'protein'
  if (/U/.test(sample)) return 'RNA'
  return 'DNA'
}

function calcConservation(seqs, pos) {
  if (!seqs.length) return 0
  const counts = {}
  for (const s of seqs) {
    const c = s.seq[pos] || '-'
    if (c !== '-') counts[c] = (counts[c] || 0) + 1
  }
  const total = seqs.length
  const maxCount = Math.max(...Object.values(counts), 0)
  return maxCount / total
}

function calcConsensus(seqs, pos) {
  if (!seqs.length) return '-'
  const counts = {}
  for (const s of seqs) {
    const c = s.seq[pos] || '-'
    counts[c] = (counts[c] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
}

export default function MSAViewer({ sequences: seqsProp, onClose }) {
  const canvasRef  = useRef(null)
  const containerRef = useRef(null)
  const [colStart, setColStart] = useState(0)
  const [seqOffset, setSeqOffset] = useState(0)
  const [cellW, setCellW] = useState(14)
  const [size, setSize] = useState({ w: 900, h: 500 })
  const [hoverCol, setHoverCol] = useState(null)
  const [selection, setSelection] = useState(null) // { col, seq } or null
  const [colorMode, setColorMode] = useState('nuc') // 'nuc' | 'conservation'

  const seqs    = seqsProp || []
  const alnLen  = seqs[0]?.seq.length || 0
  const seqType = useMemo(() => detectMSAType(seqs), [seqs])
  const colorMap = seqType === 'protein' ? AA_COLORS : NUC_COLORS
  const bgMap    = NUC_BG

  // Compute conservation array once
  const conservation = useMemo(() => {
    if (!seqs.length || !alnLen) return []
    return Array.from({ length: alnLen }, (_, i) => calcConservation(seqs, i))
  }, [seqs, alnLen])

  const consensus = useMemo(() => {
    if (!seqs.length || !alnLen) return ''
    return Array.from({ length: alnLen }, (_, i) => calcConsensus(seqs, i)).join('')
  }, [seqs, alnLen])

  // Resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const trackW  = size.w - LABEL_W
  const visibleCols = Math.floor(trackW / cellW)
  const visibleSeqs = Math.floor((size.h - RULER_H - CONS_H - ROW_H) / ROW_H) // -consensus row

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !seqs.length) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#f0f7f2'
    ctx.fillRect(0, 0, size.w, size.h)

    // ── Ruler ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#e6f2ea'
    ctx.fillRect(0, 0, size.w, RULER_H)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(LABEL_W, 0, trackW, RULER_H)

    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.fillStyle = '#6b9e82'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const tick = cellW >= 10 ? 10 : cellW >= 5 ? 20 : 50
    for (let ci = 0; ci < visibleCols; ci++) {
      const col = colStart + ci
      if (col >= alnLen) break
      const x = LABEL_W + ci * cellW + cellW / 2
      if ((col + 1) % tick === 0 || col === 0) {
        ctx.fillText(String(col + 1), x, RULER_H / 2)
        ctx.strokeStyle = '#d4eadb'
        ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(x, RULER_H - 4); ctx.lineTo(x, RULER_H); ctx.stroke()
      }
    }

    // track label border
    ctx.strokeStyle = '#b8d9c2'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(LABEL_W, 0); ctx.lineTo(LABEL_W, size.h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, RULER_H); ctx.lineTo(size.w, RULER_H); ctx.stroke()

    let y = RULER_H

    // ── Conservation track ───────────────────────────────────────────────
    ctx.fillStyle = '#e6f2ea'
    ctx.fillRect(0, y, LABEL_W, CONS_H)
    ctx.fillStyle = '#fafcfb'
    ctx.fillRect(LABEL_W, y, trackW, CONS_H)
    ctx.fillStyle = '#6b9e82'
    ctx.font = '9px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('Conservation', LABEL_W - 6, y + CONS_H / 2)

    for (let ci = 0; ci < visibleCols; ci++) {
      const col = colStart + ci
      if (col >= alnLen) break
      const cons = conservation[col] || 0
      const x    = LABEL_W + ci * cellW
      const bH   = Math.round(cons * (CONS_H - 4))
      const hue  = Math.round(130 - cons * 40)
      const sat  = Math.round(50 + cons * 20)
      const lig  = Math.round(60 - cons * 20)
      ctx.fillStyle = `hsl(${hue},${sat}%,${lig}%)`
      ctx.fillRect(x + 0.5, y + CONS_H - bH - 2, cellW - 1, bH)

      // hover highlight
      if (col === hoverCol) {
        ctx.fillStyle = 'rgba(26,122,64,0.18)'
        ctx.fillRect(x, y, cellW, CONS_H)
      }
    }
    ctx.strokeStyle = '#d4eadb'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, y + CONS_H); ctx.lineTo(size.w, y + CONS_H); ctx.stroke()
    y += CONS_H

    // ── Consensus row ────────────────────────────────────────────────────
    ctx.fillStyle = '#e6f2ea'
    ctx.fillRect(0, y, LABEL_W, ROW_H)
    ctx.fillStyle = '#f8fdf9'
    ctx.fillRect(LABEL_W, y, trackW, ROW_H)
    ctx.fillStyle = '#1a7a40'; ctx.font = '700 10px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('Consensus', LABEL_W - 6, y + ROW_H / 2)

    if (cellW >= 8) {
      ctx.font = `700 ${Math.min(13, cellW * 0.82)}px "JetBrains Mono", monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      for (let ci = 0; ci < visibleCols; ci++) {
        const col = colStart + ci
        if (col >= alnLen) break
        const nuc = consensus[col] || '-'
        const x   = LABEL_W + ci * cellW + cellW / 2
        const cons = conservation[col] || 0
        ctx.fillStyle = cons > 0.8 ? (colorMap[nuc] || '#6b9e82') : '#b8d9c2'
        ctx.fillText(nuc, x, y + ROW_H / 2)
      }
    }
    ctx.strokeStyle = '#b8d9c2'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y + ROW_H); ctx.lineTo(size.w, y + ROW_H); ctx.stroke()
    y += ROW_H

    // ── Sequence rows ────────────────────────────────────────────────────
    const seqsToShow = seqs.slice(seqOffset, seqOffset + visibleSeqs)

    for (let si = 0; si < seqsToShow.length; si++) {
      const s    = seqsToShow[si]
      const seqI = seqOffset + si
      const rowY = y + si * ROW_H
      const isOdd = si % 2 === 1

      // row background
      ctx.fillStyle = isOdd ? '#f8fdf9' : '#ffffff'
      ctx.fillRect(LABEL_W, rowY, trackW, ROW_H)

      // label bg
      ctx.fillStyle = isOdd ? '#ecf5ef' : '#f0f7f2'
      ctx.fillRect(0, rowY, LABEL_W, ROW_H)

      // ID label
      ctx.fillStyle = '#1a3326'
      ctx.font = '600 10px "JetBrains Mono", monospace'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      const labelText = s.id.length > 20 ? s.id.slice(0, 18) + '…' : s.id
      ctx.fillText(labelText, LABEL_W - 8, rowY + ROW_H / 2)

      // Cells
      if (cellW >= 6) {
        const fontSize = Math.min(13, cellW * 0.8)
        ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      }

      for (let ci = 0; ci < visibleCols; ci++) {
        const col = colStart + ci
        if (col >= alnLen) break
        const nuc  = s.seq[col] || '-'
        const x    = LABEL_W + ci * cellW
        const cons = conservation[col] || 0
        const cx   = x + cellW / 2

        // hover column
        if (col === hoverCol) {
          ctx.fillStyle = 'rgba(26,122,64,0.10)'
          ctx.fillRect(x, rowY, cellW, ROW_H)
        }

        if (nuc === '-' || nuc === '.') {
          // gap — thin line
          ctx.fillStyle = '#d4eadb'
          ctx.fillRect(x + 1, rowY + ROW_H / 2 - 1, cellW - 2, 2)
        } else {
          const fg = colorMap[nuc] || '#6b9e82'
          if (cellW >= 8) {
            // colored bg pill when conservation high
            if (cons > 0.6) {
              ctx.fillStyle = (bgMap[nuc] || '#f0f7f2')
              ctx.fillRect(x + 1, rowY + 3, cellW - 2, ROW_H - 6)
            }
            ctx.fillStyle = fg
            ctx.fillText(nuc, cx, rowY + ROW_H / 2)
          } else if (cellW >= 4) {
            ctx.fillStyle = fg + 'dd'
            ctx.fillRect(x + 0.5, rowY + 3, cellW - 1, ROW_H - 6)
          } else {
            ctx.fillStyle = fg
            ctx.fillRect(x, rowY, cellW, ROW_H)
          }
        }
      }

      // row border
      ctx.strokeStyle = '#e6f2ea'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, rowY + ROW_H); ctx.lineTo(size.w, rowY + ROW_H); ctx.stroke()
    }

    // hover column vertical line
    if (hoverCol !== null) {
      const hx = LABEL_W + (hoverCol - colStart) * cellW
      ctx.strokeStyle = 'rgba(26,122,64,0.25)'
      ctx.lineWidth = cellW
      ctx.beginPath(); ctx.moveTo(hx + cellW / 2, RULER_H); ctx.lineTo(hx + cellW / 2, size.h); ctx.stroke()
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [seqs, colStart, seqOffset, cellW, size, hoverCol, alnLen, conservation, consensus, visibleCols, visibleSeqs, colorMap])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width  = size.w + 'px'
    canvas.style.height = size.h + 'px'
  }, [size])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const handleWheel = (e) => {
    e.preventDefault()
    if (e.shiftKey) {
      // vertical scroll (sequences)
      const delta = e.deltaY > 0 ? 3 : -3
      setSeqOffset(s => Math.max(0, Math.min(seqs.length - visibleSeqs, s + delta)))
    } else {
      // horizontal scroll (columns)
      const delta = e.deltaY > 0 ? Math.ceil(visibleCols * 0.2) : -Math.ceil(visibleCols * 0.2)
      setColStart(s => Math.max(0, Math.min(alnLen - visibleCols, s + delta)))
    }
  }

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x    = e.clientX - rect.left - LABEL_W
    if (x < 0) { setHoverCol(null); return }
    const col = colStart + Math.floor(x / cellW)
    setHoverCol(col < alnLen ? col : null)
  }

  const gapPct = useMemo(() => {
    if (!seqs.length || !alnLen) return 0
    const totalGaps = seqs.reduce((acc, s) => acc + (s.seq.match(/-/g) || []).length, 0)
    return ((totalGaps / (seqs.length * alnLen)) * 100).toFixed(1)
  }, [seqs, alnLen])

  const avgCons = useMemo(() => {
    if (!conservation.length) return 0
    return (conservation.reduce((a, b) => a + b, 0) / conservation.length * 100).toFixed(1)
  }, [conservation])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0f7f2' }}>
      {/* MSA toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: '#ffffff', borderBottom: '1px solid #b8d9c2',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: '#1a3326', fontFamily: '"IBM Plex Sans", sans-serif' }}>
          🧩 MSA Viewer
        </span>
        <div style={{ height: 16, borderLeft: '1px solid #b8d9c2' }} />

        {/* Stats */}
        <span style={{ fontSize: 11, color: '#6b9e82', fontFamily: 'monospace' }}>
          {seqs.length} séq · {alnLen.toLocaleString()} col · {gapPct}% gaps · cons. {avgCons}%
        </span>
        <span style={{ fontSize: 11, color: '#9dbfad', fontFamily: 'monospace' }}>
          {seqType.toUpperCase()}
        </span>

        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <span style={{ fontSize: 11, color: '#6b9e82' }}>Zoom :</span>
        {[6, 10, 14, 20].map(w => (
          <button key={w} className={`btn ${cellW === w ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: 10 }}
            onClick={() => setCellW(w)}>
            {w}px
          </button>
        ))}

        <div style={{ height: 16, borderLeft: '1px solid #b8d9c2' }} />

        {/* Scroll */}
        <button className="btn btn-ghost" style={{ padding: '3px 8px' }}
          onClick={() => setColStart(0)}>|◀</button>
        <button className="btn btn-ghost" style={{ padding: '3px 8px' }}
          onClick={() => setColStart(s => Math.max(0, s - visibleCols))}>◀◀</button>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b9e82', minWidth: 80, textAlign: 'center' }}>
          col {colStart + 1}–{Math.min(colStart + visibleCols, alnLen)}
        </span>
        <button className="btn btn-ghost" style={{ padding: '3px 8px' }}
          onClick={() => setColStart(s => Math.min(alnLen - visibleCols, s + visibleCols))}>▶▶</button>
        <button className="btn btn-ghost" style={{ padding: '3px 8px' }}
          onClick={() => setColStart(Math.max(0, alnLen - visibleCols))}>▶|</button>

        <div style={{ height: 16, borderLeft: '1px solid #b8d9c2' }} />
        <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={onClose}>
          ✕ Fermer MSA
        </button>
      </div>

      {/* Scrollbars info */}
      <div style={{ padding: '3px 12px', background: '#e6f2ea', borderBottom: '1px solid #d4eadb', fontSize: 10, color: '#9dbfad' }}>
        Molette → défilement horizontal · Shift+Molette → défilement vertical séquences
        {hoverCol !== null && (
          <span style={{ marginLeft: 16, color: '#1a7a40', fontFamily: 'monospace' }}>
            Col {hoverCol + 1} · cons. {((conservation[hoverCol] || 0) * 100).toFixed(0)}% · consensus: {consensus[hoverCol] || '-'}
          </span>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'crosshair' }}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCol(null)}
        />
      </div>

      {/* Horizontal scrollbar */}
      <div style={{ padding: '4px 8px', background: '#f0f7f2', borderTop: '1px solid #d4eadb', flexShrink: 0 }}>
        <input type="range" min={0} max={Math.max(0, alnLen - visibleCols)} value={colStart}
          onChange={e => setColStart(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#1a7a40' }} />
      </div>
    </div>
  )
}

// Export the parser too
export { parseMSA }
