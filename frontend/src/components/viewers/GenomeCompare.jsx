import { useRef, useEffect, useState, useCallback } from 'react'

/*
  GenomeCompare — dot plot + synteny comparison for 2 small genomes
  Best for mitochondria (~16 Kbp) and plastids (~150 Kbp)
  Algorithm: diagonal dot plot O(n*m) with configurable word size
*/

const TRACK_LEFT = 60

export default function GenomeCompare({ seq1, seq2, name1, name2, onClose, width, height }) {
  const canvasRef  = useRef()
  const [wordSize, setWordSize] = useState(15)
  const [running,  setRunning]  = useState(false)
  const [dots,     setDots]     = useState([])
  const [progress, setProgress] = useState(0)

  const W = (width  || 800) - TRACK_LEFT
  const H = (height || 600) - TRACK_LEFT

  // ── Dot plot computation ────────────────────────────────────────────────────
  const compute = useCallback(() => {
    if (!seq1 || !seq2) return
    setRunning(true); setProgress(0); setDots([])

    // Build k-mer index for seq2
    const s1  = seq1.toUpperCase()
    const s2  = seq2.toUpperCase()
    const idx = new Map()
    for (let i = 0; i <= s2.length - wordSize; i++) {
      const kmer = s2.slice(i, i + wordSize)
      if (!idx.has(kmer)) idx.set(kmer, [])
      idx.get(kmer).push(i)
    }

    const found = []
    const step  = Math.max(1, Math.floor(s1.length / 1000)) // sample for perf

    let i = 0
    const chunk = () => {
      const end = Math.min(i + 2000, s1.length - wordSize)
      for (; i < end; i += step) {
        const kmer = s1.slice(i, i + wordSize)
        const hits = idx.get(kmer)
        if (hits) {
          for (const j of hits) {
            found.push({ x: i / s1.length, y: j / s2.length })
          }
        }
      }
      setProgress(Math.round(i / (s1.length - wordSize) * 100))
      if (i < s1.length - wordSize) {
        requestAnimationFrame(chunk)
      } else {
        setDots(found); setRunning(false)
      }
    }
    requestAnimationFrame(chunk)
  }, [seq1, seq2, wordSize])

  // ── Draw ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cw  = W + TRACK_LEFT
    const ch  = H + TRACK_LEFT
    canvas.width = cw * dpr; canvas.height = ch * dpr
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#f0f5ff'; ctx.fillRect(0, 0, cw, ch)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(TRACK_LEFT, 0, W, H)

    // Grid
    ctx.strokeStyle = '#e4edfb'; ctx.lineWidth = .5
    for (let t = 0; t <= 10; t++) {
      const x = TRACK_LEFT + (t / 10) * W
      const y = (t / 10) * H
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(TRACK_LEFT, y); ctx.lineTo(TRACK_LEFT + W, y); ctx.stroke()
    }

    // Axes labels
    ctx.fillStyle = '#1a3faa'; ctx.font = '11px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

    // X axis ticks (seq1)
    for (let t = 0; t <= 5; t++) {
      const pos = Math.round((t / 5) * seq1.length)
      const x   = TRACK_LEFT + (t / 5) * W
      ctx.fillStyle = '#5a7ec0'
      ctx.fillText(fmtPos(pos), x, H + 18)
    }
    ctx.save(); ctx.translate(TRACK_LEFT/2 - 4, H/2); ctx.rotate(-Math.PI/2)
    ctx.fillStyle = '#1a3faa'; ctx.font = 'bold 11px "IBM Plex Sans",sans-serif'
    ctx.fillText(name2 || 'Sequence 2', 0, 0); ctx.restore()

    ctx.fillStyle = '#1a3faa'; ctx.font = 'bold 11px "IBM Plex Sans",sans-serif'
    ctx.textBaseline = 'bottom'
    ctx.fillText(name1 || 'Sequence 1', TRACK_LEFT + W/2, H + 38)

    // Diagonal (identity line)
    if (seq1.length === seq2.length) {
      ctx.strokeStyle = '#e4edfb'; ctx.lineWidth = 1; ctx.setLineDash([4,4])
      ctx.beginPath()
      ctx.moveTo(TRACK_LEFT, 0); ctx.lineTo(TRACK_LEFT + W, H)
      ctx.stroke(); ctx.setLineDash([])
    }

    // Dots
    if (dots.length > 0) {
      ctx.fillStyle = 'rgba(26,86,219,0.65)'
      for (const d of dots) {
        const px = TRACK_LEFT + d.x * W
        const py = d.y * H
        ctx.fillRect(px, py, 1.5, 1.5)
      }
    } else if (!running) {
      ctx.fillStyle = '#b8cfef'; ctx.font = '14px "IBM Plex Sans",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('Click "Compute dot plot" to start', TRACK_LEFT + W/2, H/2)
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [dots, seq1, seq2, W, H, name1, name2, running])

  const len1 = seq1?.length || 0
  const len2 = seq2?.length || 0
  const maxLen = Math.max(len1, len2)
  const isFeasible = maxLen < 500_000

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'8px 16px', background:'#1a3faa', flexShrink:0 }}>
        <span style={{ fontSize:18, fontWeight:800, color:'#fff', fontFamily:'"IBM Plex Sans",sans-serif' }}>
          Genome Comparison — Dot Plot
        </span>
        <div style={{ fontSize:12, color:'#a0c0ff' }}>
          {name1} ({len1.toLocaleString()} bp) vs {name2} ({len2.toLocaleString()} bp)
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
          <label style={{ color:'#a0c0ff', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
            Word size
            <input type="number" value={wordSize} min={8} max={30}
              onChange={e => setWordSize(parseInt(e.target.value)||15)}
              style={{ width:56, fontSize:12, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:6, padding:'3px 8px' }} />
          </label>
          {!isFeasible && <span style={{ color:'#ffaa00', fontSize:12 }}>⚠ Sequences &gt;500 Kbp may be slow</span>}
          <button className="btn" style={{ background:'var(--yellow)', color:'#0f2460', border:'none', fontWeight:700 }}
            onClick={compute} disabled={running || !seq1 || !seq2}>
            {running ? `Computing… ${progress}%` : '▶ Compute dot plot'}
          </button>
          <button className="btn" style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff' }}
            onClick={onClose}>✕ Close</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:20, padding:'6px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <span style={{ fontSize:12, color:'var(--txt3)' }}>Dots found: <b style={{ color:'var(--txt)' }}>{dots.length.toLocaleString()}</b></span>
        <span style={{ fontSize:12, color:'var(--txt3)' }}>Word size: <b style={{ color:'var(--txt)' }}>{wordSize} bp</b></span>
        {dots.length > 0 && <span style={{ fontSize:12, color:'var(--txt3)' }}>
          Coverage: <b style={{ color:'var(--accent)' }}>{((dots.length * wordSize) / len1 * 100).toFixed(1)}%</b>
        </span>}
      </div>

      {/* Canvas */}
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        <canvas ref={canvasRef} style={{ display:'block' }} />
      </div>
    </div>
  )
}

function fmtPos(p) {
  if (p>=1e6) return (p/1e6).toFixed(1)+'M'
  if (p>=1e3) return (p/1e3).toFixed(0)+'K'
  return String(p)
}
