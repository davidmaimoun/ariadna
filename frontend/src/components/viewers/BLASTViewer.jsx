import BLASTToolbar from '../toolbars/BLASTToolbar'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'

/*
  BLASTViewer — display BLAST output files
  Supports: BLAST XML (-outfmt 5), tabular (-outfmt 6/7), JSON (-outfmt 15)
  Features:
  - Hit tracks canvas on query sequence
  - Sortable/filterable hit table
  - HSP detail on click
  - E-value color gradient
*/

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseBlastTabular(text) {
  const hits = []
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 12) continue
    const [qseqid, sseqid, pident, length, mismatch, gapopen, qstart, qend, sstart, send, evalue, bitscore] = cols
    hits.push({
      query:    qseqid,
      subject:  sseqid,
      pident:   parseFloat(pident),
      length:   parseInt(length),
      qstart:   parseInt(qstart) - 1,
      qend:     parseInt(qend) - 1,
      sstart:   parseInt(sstart) - 1,
      send:     parseInt(send) - 1,
      evalue:   parseFloat(evalue),
      bitscore: parseFloat(bitscore),
      mismatch: parseInt(mismatch),
      gapopen:  parseInt(gapopen),
    })
  }
  return hits
}

function parseBlastXML(text) {
  const hits = []
  const parser  = new DOMParser()
  const doc     = parser.parseFromString(text, 'text/xml')
  const queries = doc.querySelectorAll('Iteration')
  for (const q of queries) {
    const qdef = q.querySelector('Iteration_query-def')?.textContent || 'query'
    for (const hit of q.querySelectorAll('Hit')) {
      const sdef = hit.querySelector('Hit_def')?.textContent || ''
      const sacc = hit.querySelector('Hit_accession')?.textContent || ''
      for (const hsp of hit.querySelectorAll('Hsp')) {
        const get = (tag) => hsp.querySelector(tag)?.textContent
        hits.push({
          query:    qdef,
          subject:  sacc || sdef,
          pident:   parseFloat(get('Hsp_identity')) / parseFloat(get('Hsp_align-len')) * 100,
          length:   parseInt(get('Hsp_align-len')),
          qstart:   parseInt(get('Hsp_query-from')) - 1,
          qend:     parseInt(get('Hsp_query-to')) - 1,
          sstart:   parseInt(get('Hsp_hit-from')) - 1,
          send:     parseInt(get('Hsp_hit-to')) - 1,
          evalue:   parseFloat(get('Hsp_evalue')),
          bitscore: parseFloat(get('Hsp_bit-score')),
          mismatch: parseInt(get('Hsp_align-len')) - parseInt(get('Hsp_identity')),
          gapopen:  parseInt(get('Hsp_gaps')) || 0,
          qseq:     get('Hsp_qseq'),
          hseq:     get('Hsp_hseq'),
          midline:  get('Hsp_midline'),
        })
      }
    }
  }
  return hits
}

function parseBlastJSON(text) {
  try {
    const data   = JSON.parse(text)
    const hits   = []
    const search = data?.BlastOutput2?.[0]?.report?.results?.search
    if (!search) return hits
    const qdef   = search.query_title || 'query'
    for (const hit of search.hits || []) {
      const sacc = hit.description?.[0]?.accession || hit.description?.[0]?.title || ''
      for (const hsp of hit.hsps || []) {
        hits.push({
          query:    qdef,
          subject:  sacc,
          pident:   hsp.identity / hsp.align_len * 100,
          length:   hsp.align_len,
          qstart:   hsp.query_from - 1,
          qend:     hsp.query_to - 1,
          sstart:   hsp.hit_from - 1,
          send:     hsp.hit_to - 1,
          evalue:   hsp.evalue,
          bitscore: hsp.bit_score,
          mismatch: hsp.align_len - hsp.identity,
          gapopen:  hsp.gaps || 0,
          qseq:     hsp.qseq,
          hseq:     hsp.hseq,
          midline:  hsp.midline,
        })
      }
    }
    return hits
  } catch { return [] }
}

export function parseBlast(text, filename = '') {
  const ext = filename.split('.').pop().toLowerCase()
  if (text.trimStart().startsWith('<')) return parseBlastXML(text)
  if (text.trimStart().startsWith('{'))  return parseBlastJSON(text)
  return parseBlastTabular(text)  // default: tabular
}

// E-value → color
function evalueColor(e) {
  if (e <= 1e-100) return '#0a3fa8'
  if (e <= 1e-50)  return '#1a56db'
  if (e <= 1e-10)  return '#0e8c9e'
  if (e <= 1e-5)   return '#0a6e40'
  if (e <= 0.01)   return '#8a5e00'
  if (e <= 0.1)    return '#c0300e'
  return '#93b4f0'
}
function evalueLabel(e) {
  if (e === 0) return '0'
  const exp = Math.floor(Math.log10(e))
  return `e${exp}`
}

// ── Hit track canvas ──────────────────────────────────────────────────────────
function HitTrack({ hits, queryLen, width, onHitClick, selectedHit }) {
  const canvasRef = useRef()
  const H = Math.min(300, Math.max(80, hits.length * 12 + 40))

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    ctx_setup(canvas, width, H, dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const TL   = 180  // label width
    const TW   = width - TL
    const scale = TW / (queryLen || 1)

    // Background
    ctx.fillStyle = '#f0f5ff'; ctx.fillRect(0,0,width,H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(TL,0,TW,H)

    // Query ruler at top
    ctx.fillStyle = '#1a3faa'; ctx.fillRect(TL, 8, TW, 4)
    ctx.fillStyle = '#0f2460'; ctx.font = '10px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(`Query (${queryLen?.toLocaleString()||'?'} bp)`, TL+4, 10)

    // Hits
    const sliceH = 10
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i]
      const y   = 22 + i * (sliceH + 2)
      if (y + sliceH > H) break
      const x = TL + hit.qstart * scale
      const w = Math.max(2, (hit.qend - hit.qstart) * scale)
      const c = evalueColor(hit.evalue)
      const isSelected = selectedHit === i

      ctx.fillStyle = c + (isSelected ? 'ff' : '99')
      ctx.fillRect(x, y, w, sliceH)
      if (isSelected) {
        ctx.strokeStyle = '#ffe000'; ctx.lineWidth = 2
        ctx.strokeRect(x, y, w, sliceH)
      }

      // Label
      const label = hit.subject.length > 26 ? hit.subject.slice(0,24)+'…' : hit.subject
      ctx.fillStyle = '#1a3faa'; ctx.font = '9px "JetBrains Mono",monospace'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(label, TL-6, y+sliceH/2)
      ctx.fillStyle = '#5a7ec0'; ctx.textAlign = 'left'
      if (w > 40) ctx.fillText(`${hit.pident.toFixed(0)}%`, x+3, y+sliceH/2)
    }

    // Legend
    ctx.fillStyle = '#5a7ec0'; ctx.font = '9px "IBM Plex Sans",sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillText('Color = E-value threshold', width-6, H-2)

    const thresholds = [[1e-100,'≤1e-100'],[1e-50,'≤1e-50'],[1e-10,'≤1e-10'],[1e-5,'≤1e-5'],[0.01,'≤0.01'],[0.1,'≤0.1']]
    let lx = TL
    for (const [t, label] of thresholds) {
      ctx.fillStyle = evalueColor(t)
      ctx.fillRect(lx, H-12, 18, 8)
      ctx.fillStyle = '#5a7ec0'; ctx.font = '8px "IBM Plex Sans",sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, lx+20, H-5)
      lx += 70
      if (lx > width - 80) break
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [hits, queryLen, width, selectedHit])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width*dpr; canvas.height = H*dpr
    canvas.style.width = width+'px'; canvas.style.height = H+'px'
  }, [width, H])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const handleClick = (e) => {
    const rect  = canvasRef.current.getBoundingClientRect()
    const y     = e.clientY - rect.top
    const idx   = Math.floor((y - 22) / 12)
    if (idx >= 0 && idx < hits.length) onHitClick(idx)
  }

  return <canvas ref={canvasRef} style={{ display:'block', cursor:'pointer' }} onClick={handleClick} />
}

function ctx_setup(canvas, w, h, dpr) {
  canvas.width = w*dpr; canvas.height = h*dpr
  canvas.style.width = w+'px'; canvas.style.height = h+'px'
}

// ── Main BLAST Viewer ─────────────────────────────────────────────────────────
export default function BLASTViewer({ data, onClose, width }) {
  const hits     = data
  const { jumpTo } = useStore()
  const [selected,  setSelected]  = useState(null)
  const [sortCol,   setSortCol]   = useState('evalue')
  const [sortDir,   setSortDir]   = useState(1)
  const [minPident, setMinPident] = useState(0)
  const [maxEvalue, setMaxEvalue] = useState(10)
  const [page,      setPage]      = useState(0)
  const PAGE = 50

  const queryLen = useMemo(() => hits.length ? Math.max(...hits.map(h=>h.qend+1)) : 0, [hits])
  const queries  = useMemo(() => [...new Set(hits.map(h=>h.query))], [hits])

  const filtered = useMemo(() => {
    let h = hits.filter(x => x.pident >= minPident && x.evalue <= maxEvalue)
    return [...h].sort((a,b) => {
      const av=a[sortCol]??0, bv=b[sortCol]??0
      return sortDir*(av<bv?-1:av>bv?1:0)
    })
  }, [hits, minPident, maxEvalue, sortCol, sortDir])

  const paged = filtered.slice(page*PAGE, (page+1)*PAGE)
  const pages = Math.ceil(filtered.length/PAGE)
  const sort  = (col) => { if(sortCol===col) setSortDir(d=>-d); else{setSortCol(col);setSortDir(1)} }

  const Th = ({col,label}) => (
    <th onClick={()=>sort(col)} style={{ padding:'6px 10px', cursor:'pointer', userSelect:'none', fontSize:12, fontWeight:700, color:sortCol===col?'#1a56db':'#5a7ec0', borderBottom:'2px solid #c0d4f5', whiteSpace:'nowrap', textAlign:'left' }}>
      {label}{sortCol===col?(sortDir===1?' ↑':' ↓'):''}
    </th>
  )

  const selHit = selected !== null ? filtered[selected] : null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f0f5ff' }}>
      {/* Header */}
      <BLASTToolbar
        onClose={onClose}
        hitCount={data?.length ?? 0}
      />

      {/* Hit diagram */}
      <div style={{ background:'#f8faff', borderBottom:'1px solid #c0d4f5', flexShrink:0 }}>
        <HitTrack hits={filtered.slice(0,60)} queryLen={queryLen} width={width||900} onHitClick={i=>setSelected(i)} selectedHit={selected} />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'7px 16px', background:'#dce8fb', borderBottom:'1px solid #c0d4f5', flexShrink:0, flexWrap:'wrap' }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#1a3faa' }}>
          Min % identity
          <input type="number" value={minPident} min={0} max={100} onChange={e=>{setMinPident(parseFloat(e.target.value)||0);setPage(0)}} style={{ width:60, fontSize:12 }} />
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#1a3faa' }}>
          Max E-value
          <input type="number" value={maxEvalue} step="any" onChange={e=>{setMaxEvalue(parseFloat(e.target.value)||10);setPage(0)}} style={{ width:80, fontSize:12 }} />
        </label>
        <span style={{ fontSize:12, color:'#5a7ec0', marginLeft:'auto' }}>{filtered.length} HSPs shown</span>
      </div>

      <div style={{ flex:1, overflow:'auto' }}>
        {/* Selected HSP detail */}
        {selHit && (
          <div style={{ padding:'10px 16px', background:'#fffbe6', borderBottom:'2px solid #ffe000' }}>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:8 }}>
              {[['Subject', selHit.subject],['E-value',selHit.evalue.toExponential(2)],['Identity',selHit.pident.toFixed(1)+'%'],['Length',selHit.length+'bp'],['Query',`${selHit.qstart+1}–${selHit.qend+1}`],['Hit',`${selHit.sstart+1}–${selHit.send+1}`],['Bit score',selHit.bitscore.toFixed(0)]].map(([l,v])=>(
                <span key={l} style={{ fontSize:12, color:'#5c3d00' }}><b style={{ color:'#0f2460' }}>{l}:</b> {v}</span>
              ))}
              <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={() => jumpTo(selHit.qstart)}>Jump to position</button>
            </div>
            {selHit.qseq && (
              <div style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:11, overflowX:'auto', whiteSpace:'pre', lineHeight:1.6 }}>
                <div style={{ color:'#0a6e40' }}>Query:   {selHit.qseq}</div>
                <div style={{ color:'#5a7ec0' }}>         {selHit.midline}</div>
                <div style={{ color:'#c0300e' }}>Subject: {selHit.hseq}</div>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'"JetBrains Mono",monospace' }}>
          <thead style={{ position:'sticky', top:0, background:'#f0f5ff', zIndex:2 }}>
            <tr>
              <Th col="subject"  label="Subject" />
              <Th col="pident"   label="% Id" />
              <Th col="length"   label="Aln len" />
              <Th col="evalue"   label="E-value" />
              <Th col="bitscore" label="Bit score" />
              <Th col="qstart"   label="Q.start" />
              <Th col="qend"     label="Q.end" />
              <Th col="sstart"   label="S.start" />
              <Th col="send"     label="S.end" />
              <Th col="mismatch" label="Mismatch" />
              <Th col="gapopen"  label="Gaps" />
            </tr>
          </thead>
          <tbody>
            {paged.map((h, i) => {
              const globalI = page*PAGE + i
              const isSel   = selected === globalI
              return (
                <tr key={i} onClick={() => { setSelected(globalI); jumpTo(h.qstart) }}
                  style={{ cursor:'pointer', background: isSel ? '#fffbe6' : i%2===0?'#ffffff':'#f5f8ff' }}
                  onMouseEnter={e => { if(!isSel) e.currentTarget.style.background='#dce8fb' }}
                  onMouseLeave={e => { if(!isSel) e.currentTarget.style.background=i%2===0?'#ffffff':'#f5f8ff' }}
                >
                  <td style={{ padding:'5px 10px', color:'#1a3faa', fontWeight:600, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.subject}</td>
                  <td style={{ padding:'5px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:40, height:6, background:'#e4edfb', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:h.pident+'%', height:'100%', background:evalueColor(h.evalue), borderRadius:3 }} />
                      </div>
                      <span style={{ color:'#0f2460' }}>{h.pident.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'5px 10px', color:'#0f2460' }}>{h.length.toLocaleString()}</td>
                  <td style={{ padding:'5px 10px' }}>
                    <span style={{ padding:'1px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:evalueColor(h.evalue)+'22', color:evalueColor(h.evalue), border:`1px solid ${evalueColor(h.evalue)}44` }}>
                      {h.evalue === 0 ? '0' : h.evalue.toExponential(1)}
                    </span>
                  </td>
                  <td style={{ padding:'5px 10px', color:'#0f2460', fontWeight:600 }}>{h.bitscore.toFixed(0)}</td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{(h.qstart+1).toLocaleString()}</td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{(h.qend+1).toLocaleString()}</td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{(h.sstart+1).toLocaleString()}</td>
                  <td style={{ padding:'5px 10px', color:'#5a7ec0' }}>{(h.send+1).toLocaleString()}</td>
                  <td style={{ padding:'5px 10px', color:'#c0300e' }}>{h.mismatch}</td>
                  <td style={{ padding:'5px 10px', color:'#8a5e00' }}>{h.gapopen}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px', background:'#dce8fb', borderTop:'1px solid #c0d4f5', flexShrink:0 }}>
          <button className="btn btn-ghost" onClick={()=>setPage(0)} disabled={page===0}>|◀</button>
          <button className="btn btn-ghost" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>◀</button>
          <span style={{ fontSize:12, color:'#1a3faa' }}>Page {page+1} / {pages}</span>
          <button className="btn btn-ghost" onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1}>▶</button>
          <button className="btn btn-ghost" onClick={()=>setPage(pages-1)} disabled={page===pages-1}>▶|</button>
        </div>
      )}
    </div>
  )
}
