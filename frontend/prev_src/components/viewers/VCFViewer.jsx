import VCFToolbar from '../toolbars/VCFToolbar'
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'

/*
  VCFViewer — parse & display VCF 4.x files
  - Canvas track overlaid on sequence position
  - Filterable table: type, QUAL, FILTER, INFO
  - Click variant → jump to position in main viewer
*/

const TYPE_COLORS = {
  SNP:  { bg:'#1a56db', light:'#dce8fb', text:'#0f2460' },
  INDEL:{ bg:'#c0300e', light:'#fde0d0', text:'#7a2000' },
  MNP:  { bg:'#8a5e00', light:'#fff0c0', text:'#5c3d00' },
  INS:  { bg:'#0e8c9e', light:'#d0f0f5', text:'#065a66' },
  DEL:  { bg:'#6b3faa', light:'#ede8f9', text:'#3a1a7a' },
  OTHER:{ bg:'#5a7ec0', light:'#e4edfb', text:'#1a3faa' },
}

function parseVCF(text) {
  const variants = []
  const headers  = []
  const meta     = {}

  for (const line of text.split('\n')) {
    if (line.startsWith('##')) {
      headers.push(line)
      const m = line.match(/^##(\w+)=(.+)/)
      if (m) meta[m[1]] = m[2]
      continue
    }
    if (line.startsWith('#CHROM')) {
      meta.samples = line.split('\t').slice(9)
      continue
    }
    if (!line.trim()) continue

    const cols = line.split('\t')
    if (cols.length < 8) continue

    const [chrom, pos, id, ref, alt, qual, filter, info, format, ...sampleCols] = cols
    const alts   = alt.split(',')
    const infoMap = {}
    for (const field of info.split(';')) {
      const [k, v] = field.split('=')
      infoMap[k] = v ?? true
    }

    // Determine variant type
    let type = 'SNP'
    if (ref.length !== alts[0]?.length) {
      type = ref.length < alts[0]?.length ? 'INS' : 'DEL'
    } else if (ref.length > 1) {
      type = 'MNP'
    } else if (infoMap.INDEL) {
      type = 'INDEL'
    }

    // Parse genotype from first sample
    let gt = null
    if (format && sampleCols[0]) {
      const fmtKeys = format.split(':')
      const fmtVals = sampleCols[0].split(':')
      const gtIdx   = fmtKeys.indexOf('GT')
      if (gtIdx >= 0) gt = fmtVals[gtIdx]
    }

    variants.push({
      chrom, pos: parseInt(pos) - 1,
      id: id === '.' ? null : id,
      ref, alt, alts,
      qual: qual === '.' ? null : parseFloat(qual),
      filter: filter === 'PASS' || filter === '.' ? 'PASS' : filter,
      info: infoMap, type, gt,
      dp: infoMap.DP ? parseInt(infoMap.DP) : null,
      af: infoMap.AF ? parseFloat(infoMap.AF) : null,
    })
  }

  return { variants, meta }
}

// ── Mini canvas track (shown above main sequence) ─────────────────────────────
export function VCFTrack({ variants, width, viewStart, viewEnd }) {
  const canvasRef = useRef()
  const H = 36

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr; canvas.height = H * dpr
    canvas.style.width = width + 'px'; canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#f8faff'
    ctx.fillRect(0, 0, width, H)

    const TRACK_LEFT = 110
    const trackW     = width - TRACK_LEFT
    const span       = viewEnd - viewStart

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(TRACK_LEFT, 0, trackW, H)

    // Label
    ctx.fillStyle = '#1a3faa'; ctx.font = '11px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('Variants', TRACK_LEFT - 7, H / 2)

    const visible = variants.filter(v => v.pos >= viewStart && v.pos <= viewEnd)

    for (const v of visible) {
      const x   = TRACK_LEFT + ((v.pos - viewStart) / span) * trackW
      const c   = TYPE_COLORS[v.type] || TYPE_COLORS.OTHER
      const barW = Math.max(2, trackW / span)

      ctx.fillStyle = c.bg
      ctx.fillRect(x - barW / 2, 4, Math.max(2, barW), H - 8)

      // QUAL indicator — height proportional
      if (v.qual) {
        const qh = Math.min(H - 8, (v.qual / 60) * (H - 8))
        ctx.fillStyle = c.bg + 'cc'
        ctx.fillRect(x - barW / 2, H - 4 - qh, Math.max(2, barW), qh)
      }
    }

    ctx.strokeStyle = '#c0d4f5'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(width, H); ctx.stroke()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [variants, width, viewStart, viewEnd])

  return <canvas ref={canvasRef} style={{ display:'block' }} />
}

// ── Full VCF Viewer panel ─────────────────────────────────────────────────────
export default function VCFViewer({ data, onClose }) {
  const { viewStart, viewEnd, jumpTo } = useStore()
  const { variants, meta } = data
  const samples = meta?.samples || []
  const [filterSample, setFilterSample] = useState(null)

  const [filterType,   setFilterType]   = useState('ALL')
  const [filterPass,   setFilterPass]   = useState(false)
  const [minQual,      setMinQual]      = useState(0)
  const [search,       setSearch]       = useState('')
  const [sortCol,      setSortCol]      = useState('pos')
  const [sortDir,      setSortDir]      = useState(1)
  const [page,         setPage]         = useState(0)
  const PAGE = 50

  const types    = useMemo(() => ['ALL', ...new Set(variants.map(v => v.type))], [variants])
  const chroms   = useMemo(() => [...new Set(variants.map(v => v.chrom))],        [variants])

  const filtered = useMemo(() => {
    let v = variants
    if (filterType !== 'ALL')  v = v.filter(x => x.type === filterType)
    if (filterPass)            v = v.filter(x => x.filter === 'PASS')
    if (minQual > 0)           v = v.filter(x => x.qual >= minQual)
    if (search)                v = v.filter(x =>
      x.chrom.includes(search) || x.ref.includes(search.toUpperCase()) ||
      x.alt.includes(search.toUpperCase()) || (x.id||'').includes(search)
    )
    return [...v].sort((a, b) => {
      const av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0
      return sortDir * (av < bv ? -1 : av > bv ? 1 : 0)
    })
  }, [variants, filterType, filterPass, minQual, search, sortCol, sortDir])

  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE)
  const pages = Math.ceil(filtered.length / PAGE)

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  const Th = ({ col, label }) => (
    <th onClick={() => sort(col)} style={{ padding:'6px 10px', textAlign:'left', cursor:'pointer', userSelect:'none', fontSize:12, fontWeight:700, color: sortCol===col?'#1a56db':'#5a7ec0', borderBottom:'2px solid #c0d4f5', whiteSpace:'nowrap' }}>
      {label} {sortCol===col ? (sortDir===1?'↑':'↓') : ''}
    </th>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)' }}>
      <VCFToolbar
        onClose={onClose}
        variantCount={filtered?.length ?? 0}
        samples={samples} filterSample={filterSample} setFilterSample={setFilterSample}
        filterType={filterType} setFilterType={t=>{setFilterType(t);setPage(0)}}
        search={search} setSearch={setSearch}
      />
      <div style={{ padding:'4px 14px', fontSize:11, color:'var(--txt4)', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
        {filtered.length.toLocaleString()} shown
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'"JetBrains Mono",monospace' }}>
          <thead style={{ position:'sticky', top:0, background:'#f0f5ff', zIndex:2 }}>
            <tr>
              <Th col="chrom" label="CHROM" />
              <Th col="pos"   label="POS" />
              <th style={{ padding:'6px 10px', fontSize:12, fontWeight:700, color:'#5a7ec0', borderBottom:'2px solid #c0d4f5' }}>ID</th>
              <Th col="ref"   label="REF" />
              <Th col="alt"   label="ALT" />
              <Th col="qual"  label="QUAL" />
              <Th col="filter" label="FILTER" />
              <Th col="type"  label="TYPE" />
              <Th col="dp"    label="DP" />
              <Th col="af"    label="AF" />
              <th style={{ padding:'6px 10px', fontSize:12, fontWeight:700, color:'#5a7ec0', borderBottom:'2px solid #c0d4f5' }}>GT</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((v, i) => {
              const c = TYPE_COLORS[v.type] || TYPE_COLORS.OTHER
              return (
                <tr key={i}
                  onClick={() => jumpTo(v.pos)}
                  style={{ cursor:'pointer', background: i%2===0?'#ffffff':'#f5f8ff', transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#dce8fb'}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#ffffff':'#f5f8ff'}
                >
                  <td style={{ padding:'5px 10px', color:'#1a3faa', fontWeight:600 }}>{v.chrom}</td>
                  <td style={{ padding:'5px 10px', color:'#0f2460' }}>{(v.pos+1).toLocaleString()}</td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{v.id || '—'}</td>
                  <td style={{ padding:'5px 10px', color:'#0a6e40', fontWeight:700 }}>{v.ref}</td>
                  <td style={{ padding:'5px 10px', color:'#c0300e', fontWeight:700 }}>{v.alt}</td>
                  <td style={{ padding:'5px 10px', color:'#0f2460' }}>{parseFloat(v.qual)?.toFixed(1) ?? '—'}</td>
                  <td style={{ padding:'5px 10px' }}>
                    <span style={{ padding:'1px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:v.filter==='PASS'?'#d4f0de':'#fde0d0', color:v.filter==='PASS'?'#0a4020':'#7a2000' }}>{v.filter}</span>
                  </td>
                  <td style={{ padding:'5px 10px' }}>
                    <span style={{ padding:'1px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:c.light, color:c.text }}>{v.type}</span>
                  </td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{v.dp ?? '—'}</td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{v.af?.toFixed(3) ?? '—'}</td>
                  <td style={{ padding:'5px 10px', color:'#1a3faa' }}>{v.gt ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px', background:'#dce8fb', borderTop:'1px solid #c0d4f5', flexShrink:0 }}>
          <button className="btn btn-ghost" onClick={() => setPage(0)} disabled={page===0}>|◀</button>
          <button className="btn btn-ghost" onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}>◀</button>
          <span style={{ fontSize:12, color:'#1a3faa' }}>Page {page+1} / {pages}</span>
          <button className="btn btn-ghost" onClick={() => setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1}>▶</button>
          <button className="btn btn-ghost" onClick={() => setPage(pages-1)} disabled={page===pages-1}>▶|</button>
        </div>
      )}
    </div>
  )
}

export { parseVCF }
