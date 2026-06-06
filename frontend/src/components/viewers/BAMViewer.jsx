import BAMToolbar from '../toolbars/BAMToolbar'
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'

/*
  BAMViewer — SAM parsing (client-side) + BAM via Flask
  Pileup canvas: reads stacked like IGV
  Supports: SAM text drag-drop, BAM via /api/bam endpoint
*/

const NUC_FG = { A:'#0a6e40', T:'#c0300e', G:'#1a3faa', C:'#8a5e00', N:'#93b4f0', '=':'#aaaaaa' }
const NUC_BG = { A:'#d4f0de', T:'#fde0d0', G:'#d0e4ff', C:'#fff0c0', N:'#e8f0fb', '=':'#f0f0f0' }

const TRACK_LEFT = 110
const READ_H     = 10
const READ_GAP   = 2
const RULER_H    = 28

// ── SAM parser (client-side) ──────────────────────────────────────────────────
function parseSAM(text) {
  const reads   = []
  const headers = []
  const sq      = {}  // sequence lengths

  for (const line of text.split('\n')) {
    if (line.startsWith('@')) {
      headers.push(line)
      if (line.startsWith('@SQ')) {
        const sn = line.match(/SN:(\S+)/)?.[1]
        const ln = line.match(/LN:(\d+)/)?.[1]
        if (sn && ln) sq[sn] = parseInt(ln)
      }
      continue
    }
    if (!line.trim()) continue

    const cols = line.split('\t')
    if (cols.length < 11) continue

    const [qname, flagStr, rname, posStr, mapq, cigar, rnext, pnext, tlen, seq, qual, ...tags] = cols
    const flag  = parseInt(flagStr)
    const pos   = parseInt(posStr) - 1
    if (pos < 0 || rname === '*' || cigar === '*') continue

    const strand   = (flag & 16) ? -1 : 1
    const isPaired = !!(flag & 1)
    const isRead2  = !!(flag & 128)
    const refLen   = cigarRefLen(cigar)

    // Parse tags
    const tagMap = {}
    for (const t of tags) {
      const m = t.match(/^([A-Z]{2}):([AifZHB]):(.+)/)
      if (m) tagMap[m[1]] = m[3]
    }

    reads.push({
      qname, flag, rname, pos, end: pos + refLen - 1,
      mapq: parseInt(mapq), cigar, seq, qual,
      strand, isPaired, isRead2,
      nm: tagMap.NM ? parseInt(tagMap.NM) : null,
      md: tagMap.MD || null,
    })
  }

  return { reads, headers, sq }
}

function cigarRefLen(cigar) {
  let len = 0
  for (const m of cigar.matchAll(/(\d+)([MIDNSHP=X])/g)) {
    const n = parseInt(m[1]), op = m[2]
    if ('MDN=X'.includes(op)) len += n
  }
  return len || 1
}

// Build pileup: assign reads to rows (greedy non-overlapping)
function buildRows(reads, start, end) {
  const visible = reads.filter(r => r.end >= start && r.pos <= end)
  const rows    = []
  for (const r of visible) {
    let placed = false
    for (const row of rows) {
      if (row[row.length - 1].end < r.pos - 1) {
        row.push(r); placed = true; break
      }
    }
    if (!placed) rows.push([r])
  }
  return rows
}

// Compute coverage array for viewStart→viewEnd
function buildCoverage(reads, start, end) {
  const len = end - start
  const cov = new Int32Array(len)
  for (const r of reads) {
    const s = Math.max(0, r.pos - start)
    const e = Math.min(len, r.end - start + 1)
    for (let i = s; i < e; i++) cov[i]++
  }
  return cov
}

// ── Pileup Canvas ─────────────────────────────────────────────────────────────
function PileupCanvas({ reads, width, height }) {
  const canvasRef = useRef()
  const { viewStart, viewEnd, panBy, zoomTo, setTooltip } = useStore()

  const rows     = useMemo(() => buildRows(reads, viewStart, viewEnd), [reads, viewStart, viewEnd])
  const coverage = useMemo(() => buildCoverage(reads, viewStart, viewEnd), [reads, viewStart, viewEnd])

  const COV_H    = 60
  const trackW   = width - TRACK_LEFT
  const span     = viewEnd - viewStart
  const bpWidth  = trackW / span

  const posToX = (pos) => TRACK_LEFT + ((pos - viewStart) / span) * trackW

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx    = canvas.getContext('2d')
    const dpr    = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#f0f5ff'
    ctx.fillRect(0, 0, width, height)

    let y = 0

    // ── Ruler ───────────────────────────────────────────────────────────────
    ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, width, RULER_H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(TRACK_LEFT, y, trackW, RULER_H)
    ctx.fillStyle = '#1a3faa'; ctx.font = '10px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Ruler', TRACK_LEFT/2, y+RULER_H/2)

    const tickInt = calcTick(span, trackW)
    const first   = Math.ceil(viewStart / tickInt) * tickInt
    ctx.font = '10px "JetBrains Mono",monospace'; ctx.fillStyle = '#5a7ec0'
    for (let pos = first; pos <= viewEnd; pos += tickInt) {
      const x = posToX(pos)
      ctx.fillText(fmtPos(pos), x, y + RULER_H/2)
      ctx.strokeStyle = '#c0d4f5'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(x, y+RULER_H-5); ctx.lineTo(x, y+RULER_H); ctx.stroke()
    }
    ctx.strokeStyle = '#c0d4f5'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0,y+RULER_H); ctx.lineTo(width,y+RULER_H); ctx.stroke()
    y += RULER_H

    // ── Coverage track ───────────────────────────────────────────────────────
    ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, TRACK_LEFT, COV_H)
    ctx.fillStyle = '#fafcff'; ctx.fillRect(TRACK_LEFT, y, trackW, COV_H)
    ctx.fillStyle = '#1a3faa'; ctx.font = '10px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('Coverage', TRACK_LEFT-7, y+COV_H/2)

    const maxCov = Math.max(1, ...coverage)
    const covBpW = Math.max(1, bpWidth)
    for (let i = 0; i < coverage.length; i++) {
      const bh = (coverage[i] / maxCov) * (COV_H - 6)
      const hue = Math.round(210 + (coverage[i]/maxCov)*20)
      ctx.fillStyle = `hsl(${hue},65%,${55-coverage[i]/maxCov*15}%)`
      ctx.fillRect(TRACK_LEFT + i * covBpW, y + COV_H - bh - 3, Math.max(1, covBpW), bh)
    }
    // max label
    ctx.fillStyle = '#93b4f0'; ctx.font = '9px "JetBrains Mono",monospace'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(maxCov+'×', TRACK_LEFT+4, y+2)
    ctx.strokeStyle = '#c0d4f5'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0,y+COV_H); ctx.lineTo(width,y+COV_H); ctx.stroke()
    y += COV_H

    // ── Read rows ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#dce8fb'; ctx.fillRect(0, y, TRACK_LEFT, height-y)
    ctx.fillStyle = '#ffffff';  ctx.fillRect(TRACK_LEFT, y, trackW, height-y)
    ctx.fillStyle = '#1a3faa'; ctx.font = '10px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(`${reads.length} reads`, TRACK_LEFT-7, y+4)

    let ry = y
    for (const row of rows) {
      if (ry + READ_H > height) break
      for (const read of row) {
        const rx = posToX(read.pos)
        const rw = Math.max(2, (read.end - read.pos + 1) * bpWidth)

        // Read body color by strand
        ctx.fillStyle = read.strand === 1 ? '#dce8fb' : '#fde0d0'
        ctx.strokeStyle = read.strand === 1 ? '#1a56db' : '#c0300e'
        ctx.lineWidth = 0.8
        roundRect(ctx, rx, ry+1, rw, READ_H-2, 2)
        ctx.fill(); ctx.stroke()

        // Direction arrow
        if (rw > 16) {
          ctx.fillStyle = read.strand === 1 ? '#1a56db' : '#c0300e'
          const ax = read.strand === 1 ? rx+rw-1 : rx+1
          const ay = ry + READ_H/2
          ctx.beginPath()
          if (read.strand === 1) { ctx.moveTo(ax-5,ay-3); ctx.lineTo(ax,ay); ctx.lineTo(ax-5,ay+3) }
          else                   { ctx.moveTo(ax+5,ay-3); ctx.lineTo(ax,ay); ctx.lineTo(ax+5,ay+3) }
          ctx.fill()
        }

        // Nucleotide letters at high zoom
        if (bpWidth >= 10 && read.seq && read.seq !== '*') {
          ctx.font = `bold ${Math.min(10, bpWidth*0.65)}px "JetBrains Mono",monospace`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          for (let i = 0; i < read.seq.length; i++) {
            const nuc = read.seq[i].toUpperCase()
            const nx  = posToX(read.pos + i) + bpWidth/2
            if (nx < TRACK_LEFT || nx > width) continue
            ctx.fillStyle = NUC_FG[nuc] || '#5a7ec0'
            ctx.fillText(nuc, nx, ry + READ_H/2)
          }
        }
      }
      ry += READ_H + READ_GAP
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [reads, width, height, viewStart, viewEnd, coverage, rows, bpWidth, trackW, span])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width*dpr; canvas.height = height*dpr
    canvas.style.width = width+'px'; canvas.style.height = height+'px'
  }, [width, height])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x    = e.clientX - rect.left - TRACK_LEFT
      const pos  = Math.round(viewStart + (x/trackW)*span)
      zoomTo(pos, e.deltaY > 0 ? 2 : 0.5)
    } else {
      panBy(Math.round((e.deltaY/100)*(viewEnd-viewStart)*0.3))
    }
  }, [viewStart, viewEnd, span, trackW, panBy, zoomTo])

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x    = e.clientX - rect.left
    if (x < TRACK_LEFT) { setTooltip(null); return }
    const pos = Math.round(viewStart + ((x-TRACK_LEFT)/trackW)*span)
    const covIdx = pos - viewStart
    const cov    = coverage[covIdx] ?? 0
    setTooltip({ x:e.clientX+14, y:e.clientY-12, content:`pos ${(pos+1).toLocaleString()} · coverage ${cov}×` })
  }, [viewStart, span, trackW, coverage, setTooltip])

  return (
    <canvas ref={canvasRef}
      style={{ display:'block', cursor:'crosshair' }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => useStore.getState().setTooltip(null)}
    />
  )
}

// ── Main BAM Viewer ───────────────────────────────────────────────────────────
export default function BAMViewer({ data, onClose, width, height }) {
  const { viewStart, viewEnd } = useStore()
  const { reads, sq } = data

  const chroms  = useMemo(() => [...new Set(reads.map(r=>r.rname))], [reads])
  const [chrom, setChrom] = useState(chroms[0] || '')
  const filtered = useMemo(() => reads.filter(r=>r.rname===chrom), [reads, chrom])

  const stats = useMemo(() => ({
    total:   reads.length,
    mapped:  reads.filter(r=>!(r.flag&4)).length,
    paired:  reads.filter(r=>r.flag&1).length,
    avgLen:  reads.length ? Math.round(reads.reduce((a,r)=>a+r.seq.length,0)/reads.length) : 0,
    avgMapq: reads.length ? Math.round(reads.reduce((a,r)=>a+r.mapq,0)/reads.length) : 0,
  }), [reads])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)' }}>
      <BAMToolbar
        onClose={onClose}
        readCount={filtered?.length ?? 0}
        chroms={chroms} chrom={chrom} setChrom={setChrom}
        sq={sq}
      />
      <div style={{ flex:1, overflow:'hidden' }}>
        <PileupCanvas reads={filtered} width={width||900} height={height||500} />
      </div>
    </div>
  )
}

export { parseSAM }

// ── helpers ───────────────────────────────────────────────────────────────────
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
function calcTick(span,w){const raw=span/Math.floor(w/80);const mag=Math.pow(10,Math.floor(Math.log10(raw)));for(const n of[1,2,5,10])if(raw<=n*mag)return n*mag;return mag*10}
function fmtPos(p){if(p>=1e6)return(p/1e6).toFixed(1)+'M';if(p>=1e3)return(p/1e3).toFixed(0)+'K';return String(p)}
