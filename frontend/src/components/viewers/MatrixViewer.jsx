import MatrixToolbar from '../toolbars/MatrixToolbar'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { X, Download, Search, ZoomIn, ZoomOut } from 'lucide-react'

const COLORSCALES = {
  'Viridis': (t) => {
    const stops=[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]
    const idx=t*(stops.length-1), lo=Math.floor(idx), hi=Math.min(lo+1,stops.length-1), f=idx-lo
    const [r1,g1,b1]=stops[lo],[r2,g2,b2]=stops[hi]
    return `rgb(${Math.round(r1+(r2-r1)*f)},${Math.round(g1+(g2-g1)*f)},${Math.round(b1+(b2-b1)*f)})`
  },
  'Blue→White': (t) => { const v=Math.round(255*t); return `rgb(${v},${v},255)` },
  'White→Blue': (t) => { const v=Math.round(255*(1-t)); return `rgb(${v},${v},255)` },
  'RdYlGn': (t) => {
    if (t<0.5) { const f=t*2; return `rgb(255,${Math.round(f*200)},0)` }
    const f=(t-0.5)*2; return `rgb(${Math.round((1-f)*200)},${Math.round(160+f*95)},0)`
  },
  'Grayscale': (t) => { const v=Math.round(255*(1-t)); return `rgb(${v},${v},${v})` },
}

export function parseMatrix(text) {
  const lines=text.trim().split('\n').filter(l=>l.trim()&&!l.startsWith('#'))
  if (lines.length<2) throw new Error('Need at least 2 lines')
  const sep=lines[0].includes('\t')?'\t':','
  const headerRow=lines[0].split(sep)
  const isAllelic=headerRow[0].trim().toUpperCase()==='FILE'||headerRow[0].trim()===''||
    (/^[A-Z]{2,}/.test(headerRow[0].trim())&&isNaN(parseFloat(headerRow[1])))
  const dataLines=lines.slice(1).filter(l=>l.trim())
  const rowLabels=dataLines.map(l=>l.split(sep)[0].trim())
  const n=rowLabels.length
  let values, colLabels, isSymmetric=false
  if (isAllelic) {
    colLabels=headerRow.slice(1).map(s=>s.trim())
    values=dataLines.map(l=>l.split(sep).slice(1).map(v=>{ const x=parseFloat(v.trim()); return isNaN(x)?null:x }))
    isSymmetric=false
  } else {
    colLabels=rowLabels
    values=dataLines.map(l=>{ const c=l.split(sep).slice(1); return c.map(v=>{ const x=parseFloat(v.trim()); return isNaN(x)?null:x }) })
    isSymmetric=true
  }
  let minVal=Infinity, maxVal=-Infinity
  for (let i=0;i<values.length;i++) for (let j=0;j<values[i].length;j++) {
    const v=values[i][j]; if (v===null) continue; if (isSymmetric&&i===j) continue
    if (v<minVal) minVal=v; if (v>maxVal) maxVal=v
  }
  return { rowLabels, colLabels, values, isAllelic, isSymmetric, minVal, maxVal, n, nCols:colLabels.length }
}

export default function MatrixViewer({ data, onClose }) {
  const canvasRef    = useRef()
  const containerRef = useRef()
  const [size,       setSize]       = useState({ w:900, h:600 })
  const [cellSize,   setCellSize]   = useState(null)
  const [colorscale, setColorscale] = useState('Viridis')
  const [hovered,    setHovered]    = useState(null)
  const [search,     setSearch]     = useState('')
  const [sortMode,   setSortMode]   = useState('original')
  const [highlight,  setHighlight]  = useState(null)
  const [viewMode,   setViewMode]   = useState('table') // 'table' | 'heatmap' | 'pa'
  const [tableFontSize, setTableFontSize] = useState(11)
  const [paThreshold,setPaThreshold]= useState(0)

  const { rowLabels, colLabels, values, isSymmetric, minVal, maxVal, n, nCols } = data

  const rowOrder = useMemo(() => {
    const idxs=[...Array(n).keys()]
    if (sortMode==='sum') return idxs.sort((a,b)=>values[a].reduce((s,v)=>s+(v||0),0)-values[b].reduce((s,v)=>s+(v||0),0))
    if (sortMode==='alpha') return idxs.sort((a,b)=>rowLabels[a].localeCompare(rowLabels[b]))
    return idxs
  },[sortMode,values,rowLabels,n])

  const colOrder = useMemo(() => {
    const idxs=[...Array(nCols).keys()]
    if (isSymmetric&&sortMode!=='original') return rowOrder.slice(0,nCols)
    return idxs
  },[sortMode,isSymmetric,rowOrder,nCols])

  // Search filters ROWS only (whole row kept), and ONLY in table mode.
  const filteredRows = useMemo(() => {
    if (viewMode!=='table' || !search) return rowOrder
    const q=search.toLowerCase()
    return rowOrder.filter(i=>rowLabels[i].toLowerCase().includes(q))
  },[rowOrder,rowLabels,search,viewMode])

  // Columns are never filtered — the entire row stays visible.
  const filteredCols = colOrder

  useEffect(() => {
    const el=containerRef.current; if(!el) return
    const ro=new ResizeObserver(([e])=>setSize({w:Math.floor(e.contentRect.width),h:Math.floor(e.contentRect.height)}))
    ro.observe(el); return()=>ro.disconnect()
  },[])

  // Layout — label gutters sized to the actual labels (avoids big white margins)
  const longestRow = filteredRows.reduce((m,i)=>Math.max(m,(rowLabels[i]||'').length),0)
  const longestCol = filteredCols.reduce((m,j)=>Math.max(m,(colLabels[j]||'').length),0)
  const LABEL_W  = Math.min(180, Math.max(46, longestRow*7 + 14))   // left row-label gutter
  const LABEL_H  = Math.min(160, Math.max(40, Math.round(Math.min(longestCol,18)*5.2) + 22))  // top col-label gutter
  const CB_H     = 28   // colorbar height at bottom
  const trackW   = Math.max(1, size.w - LABEL_W)
  const trackH   = Math.max(1, size.h - LABEL_H - CB_H - 40)
  const autoCell = Math.max(2, Math.min(Math.floor(trackW/Math.max(1,filteredCols.length)), Math.floor(trackH/Math.max(1,filteredRows.length)), 32))
  const cell     = cellSize || autoCell
  const colorFn  = COLORSCALES[colorscale] || COLORSCALES.Viridis
  const range    = maxVal-minVal || 1

  const cellColor = (v, i, j) => {
    if (v===null||v===undefined) return '#f0f5ff'
    if (viewMode==='pa') return v>paThreshold?'#1a56db':'#f0f5ff'
    const t=Math.max(0,Math.min(1,(v-minVal)/range))
    return colorFn(t)
  }

  const draw = useCallback(() => {
    if (viewMode==='table') return // table is rendered as HTML
    const canvas=canvasRef.current; if(!canvas) return
    const dpr=window.devicePixelRatio||1
    // Canvas width/height based on content, not container
    const totalW = LABEL_W + filteredCols.length*cell
    const totalH = LABEL_H + filteredRows.length*cell + CB_H + 4
    canvas.width=totalW*dpr; canvas.height=totalH*dpr
    canvas.style.width=totalW+'px'; canvas.style.height=totalH+'px'

    const ctx=canvas.getContext('2d')
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,totalW,totalH)

    // ── Cells first (behind labels) ────────────────────────────────────────
    for (let ri=0;ri<filteredRows.length;ri++) {
      const i=filteredRows[ri]
      const ry=LABEL_H+ri*cell
      const isHL=rowLabels[i]===highlight
      if (isHL) { ctx.fillStyle='rgba(26,86,219,0.06)'; ctx.fillRect(LABEL_W,ry,filteredCols.length*cell,cell) }
      for (let ci=0;ci<filteredCols.length;ci++) {
        const j=filteredCols[ci]
        const v=values[i]?.[j]
        const rx=LABEL_W+ci*cell
        const isD=isSymmetric&&i===j
        ctx.fillStyle=isD?'#e4edfb':cellColor(v,i,j)
        ctx.fillRect(rx,ry,cell,cell)
        if (isD&&cell>4) { ctx.fillStyle='rgba(26,86,219,0.15)'; ctx.fillRect(rx,ry,cell,cell) }
        if (hovered&&hovered.ri===ri&&hovered.ci===ci) {
          ctx.strokeStyle='#ffe000'; ctx.lineWidth=2; ctx.strokeRect(rx+1,ry+1,cell-2,cell-2)
        }
        if (cell>=28&&v!==null) {
          const lum=(v-minVal)/range
          ctx.fillStyle=lum>0.6?'#fff':'#0f2460'
          ctx.font=`${Math.min(10,cell*0.35)}px "JetBrains Mono",monospace`
          ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText(Number.isInteger(v)?v:v.toFixed(1), rx+cell/2, ry+cell/2)
        }
      }
    }

    // ── Grid ──────────────────────────────────────────────────────────────
    if (cell>=4&&cell<=16) {
      ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=0.5
      for (let ri=0;ri<=filteredRows.length;ri++) {
        const y=LABEL_H+ri*cell; ctx.beginPath(); ctx.moveTo(LABEL_W,y); ctx.lineTo(LABEL_W+filteredCols.length*cell,y); ctx.stroke()
      }
      for (let ci=0;ci<=filteredCols.length;ci++) {
        const x=LABEL_W+ci*cell; ctx.beginPath(); ctx.moveTo(x,LABEL_H); ctx.lineTo(x,LABEL_H+filteredRows.length*cell); ctx.stroke()
      }
    }

    // ── Header backgrounds (drawn BEFORE labels so labels sit on top) ───────
    ctx.fillStyle = '#eef3ff'; ctx.fillRect(0, 0, totalW, LABEL_H)   // top header
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(0, 0, LABEL_W, totalH)   // left column

    // ── Row labels (left side) ─────────────────────────────────────────────
    const labelFs=Math.min(11,Math.max(7,cell*0.75))
    ctx.textAlign='right'; ctx.textBaseline='middle'
    for (let ri=0;ri<filteredRows.length;ri++) {
      const i=filteredRows[ri]
      const ry=LABEL_H+ri*cell+cell/2
      const isHL=rowLabels[i]===highlight
      // row label background
      ctx.fillStyle=isHL?'#e4edfb':'#f8faff'
      ctx.fillRect(0, LABEL_H+ri*cell, LABEL_W-2, cell)
      ctx.font=`${isHL?'bold ':' '}${labelFs}px "IBM Plex Sans",sans-serif`
      ctx.fillStyle=isHL?'#1a56db':'#0f2460'
      // clip long labels
      const label=rowLabels[i].length>18?rowLabels[i].slice(0,16)+'…':rowLabels[i]
      ctx.fillText(label, LABEL_W-5, ry)
    }


    // ── Column labels — straight UP (-90°), clipped to header area ──────────────
    // After rotate(-PI/2): canvas +x axis = screen UP direction
    // textAlign='left' → text extends in +x = UP ✓
    // textBaseline='bottom' → text bottom edge at anchor (no pixels below LABEL_H)
    // ctx.clip() ensures absolutely nothing bleeds into cells
    const colFs = Math.min(11, Math.max(7, cell * 0.85))
    ctx.save()
    ctx.beginPath()
    ctx.rect(LABEL_W, 0, filteredCols.length * cell + 2, LABEL_H)
    ctx.clip()  // clip: labels CANNOT exceed header area
    ctx.font = `${colFs}px "JetBrains Mono",monospace`
    for (let ci = 0; ci < filteredCols.length; ci++) {
      const j = filteredCols[ci]
      const colCx = LABEL_W + ci * cell + cell / 2
      ctx.save()
      ctx.translate(colCx, LABEL_H - 3)   // anchor at bottom of header
      ctx.rotate(-Math.PI / 4)             // -45°: +x = upper-right in screen
      ctx.textAlign = 'left'               // text starts at anchor → goes upper-right
      ctx.textBaseline = 'middle'
      const lbl = colLabels[j].length > 18 ? colLabels[j].slice(0,16)+'…' : colLabels[j]
      ctx.fillStyle = '#1a3faa'
      ctx.fillText(lbl, 3, 0)
      ctx.restore()
    }
    ctx.restore()  // restore clip
    // Border between header and cells
    ctx.strokeStyle = '#b8cfef'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(LABEL_W, LABEL_H); ctx.lineTo(totalW, LABEL_H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(LABEL_W, 0); ctx.lineTo(LABEL_W, LABEL_H+filteredRows.length*cell); ctx.stroke()


    // ── Colorbar (only heatmap) ────────────────────────────────────────────
    if (viewMode==='heatmap') {
      const cbY=LABEL_H+filteredRows.length*cell+6
      const cbW=Math.min(280,filteredCols.length*cell)
      for (let px=0;px<cbW;px++) { ctx.fillStyle=colorFn(px/cbW); ctx.fillRect(LABEL_W+px,cbY,1,12) }
      ctx.strokeStyle='#b8cfef'; ctx.lineWidth=0.5; ctx.strokeRect(LABEL_W,cbY,cbW,12)
      ctx.font='9px "JetBrains Mono",monospace'; ctx.fillStyle='#5a7ec0'
      ctx.textAlign='left';  ctx.textBaseline='top'; ctx.fillText(minVal.toFixed(1),LABEL_W,cbY+14)
      ctx.textAlign='right'; ctx.fillText(maxVal.toFixed(1),LABEL_W+cbW,cbY+14)
      ctx.textAlign='center'; ctx.fillText(colorscale,LABEL_W+cbW/2,cbY+14)
    } else if (viewMode==='pa') {
      const cbY=LABEL_H+filteredRows.length*cell+6
      ctx.font='10px "IBM Plex Sans",sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#0f2460'
      ctx.fillStyle='#1a56db'; ctx.fillRect(LABEL_W,cbY,16,12)
      ctx.fillStyle='#0f2460'; ctx.fillText(`Present (>${paThreshold})`,LABEL_W+20,cbY+6)
      ctx.fillStyle='#f0f5ff'; ctx.fillRect(LABEL_W+140,cbY,16,12); ctx.strokeStyle='#b8cfef'; ctx.lineWidth=0.5; ctx.strokeRect(LABEL_W+140,cbY,16,12)
      ctx.fillStyle='#5a7ec0'; ctx.fillText('Absent',LABEL_W+160,cbY+6)
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [filteredRows,filteredCols,values,rowLabels,colLabels,cell,colorFn,colorscale,hovered,highlight,isSymmetric,minVal,maxVal,range,viewMode,paThreshold])

  useEffect(() => { if(viewMode!=='table') requestAnimationFrame(draw) },[draw,viewMode])

  const handleMouseMove = (e) => {
    const rect=canvasRef.current?.getBoundingClientRect(); if(!rect) return
    const x=e.clientX-rect.left, y=e.clientY-rect.top
    const ci=Math.floor((x-LABEL_W)/cell), ri=Math.floor((y-LABEL_H)/cell)
    if (ci>=0&&ci<filteredCols.length&&ri>=0&&ri<filteredRows.length) {
      const i=filteredRows[ri], j=filteredCols[ci]
      setHovered({ ri, ci, rowLabel:rowLabels[i], colLabel:colLabels[j], value:values[i]?.[j], x:e.clientX, y:e.clientY })
    } else setHovered(null)
  }

  const exportPNG = () => {
    const canvas=canvasRef.current; if(!canvas) return
    const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='matrix.png'; a.click()
  }
  const exportTSV = () => {
    const rows=[['',  ...filteredCols.map(j=>colLabels[j])]]
    for (const i of filteredRows) rows.push([rowLabels[i],...filteredCols.map(j=>values[i]?.[j]??'')])
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join('\t')).join('\n')],{type:'text/plain'}))
    a.download='matrix.tsv'; a.click()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)', fontFamily:'"IBM Plex Sans",sans-serif' }}>
      <MatrixToolbar
        onClose={onClose}
        viewMode={viewMode} setViewMode={setViewMode}
        colorscale={colorscale} setColorscale={setColorscale} COLORSCALES={COLORSCALES}
        sortMode={sortMode} setSortMode={setSortMode}
        search={search} setSearch={setSearch}
        cellSize={cellSize} setCellSize={setCellSize} autoCell={autoCell}
        tableFontSize={tableFontSize} setTableFontSize={setTableFontSize}
        paThreshold={paThreshold} setPaThreshold={setPaThreshold}
        filteredRows={filteredRows} filteredCols={filteredCols}
        minVal={minVal} maxVal={maxVal}
        onExportPNG={(viewMode==="heatmap"||viewMode==="pa") ? exportPNG : null}
      />

      {/* Content */}
      <div ref={containerRef} style={{ flex:1, overflow:'auto', background:'#fafcff', cursor:'crosshair' }}>
        {viewMode==='table' ? (
          /* HTML table view */
          <table style={{ borderCollapse:'collapse', fontSize:tableFontSize, fontFamily:'"JetBrains Mono",monospace', whiteSpace:'nowrap' }}>
            <thead style={{ position:'sticky', top:0, background:'#f0f5ff', zIndex:2 }}>
              <tr style={{ height:90 }}>
                <th style={{ padding:'6px 10px', borderBottom:'2px solid var(--border)', textAlign:'left', fontSize:11, color:'var(--txt3)', minWidth:LABEL_W, position:'sticky', left:0, background:'#f0f5ff', zIndex:3, verticalAlign:'bottom' }}></th>
                {filteredCols.map(j=>(
                  <th key={j} style={{ padding:'4px 6px 6px', borderBottom:'2px solid var(--border)', textAlign:'center', color:'var(--txt2)', fontWeight:600, verticalAlign:'bottom', height:90 }}>
                    <div style={{ transform:'rotate(-45deg)', transformOrigin:'bottom left', whiteSpace:'nowrap', fontSize:Math.max(9,tableFontSize-2), maxWidth:120, display:'inline-block' }}>
                      {colLabels[j].slice(0,18)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((i,ri)=>(
                <tr key={i} style={{ background:i===highlight?'#e4edfb':ri%2===0?'#fff':'#f8faff' }}
                  onClick={()=>setHighlight(h=>h===rowLabels[i]?null:rowLabels[i])}>
                  <td style={{ padding:'4px 10px', fontWeight:600, fontSize:tableFontSize, color:rowLabels[i]===highlight?'#1a56db':'#0f2460', borderRight:'1px solid var(--border2)', position:'sticky', left:0, background:'inherit' }}>
                    {rowLabels[i].slice(0,20)}
                  </td>
                  {filteredCols.map(j=>{
                    const v=values[i]?.[j]
                    return (
                      <td key={j} style={{
                        padding:'3px 6px', textAlign:'center', fontSize:tableFontSize,
                        background: v===null?'transparent': viewMode==='heatmap'?colorFn(Math.max(0,Math.min(1,(v-minVal)/range))):'transparent',
                        color: v!==null&&(v-minVal)/range>0.6?'#fff':'var(--txt)',
                        borderBottom:'1px solid var(--border2)',
                      }}>
                        {v===null?'—':Number.isInteger(v)?v:v.toFixed(1)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <canvas ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={()=>setHovered(null)}
            onClick={()=>{ if(hovered) setHighlight(h=>h===hovered.rowLabel?null:hovered.rowLabel) }}
          />
        )}
      </div>

      {/* Tooltip */}
      {hovered&&(
        <div style={{ position:'fixed', left:hovered.x+14, top:hovered.y-14, zIndex:9999, background:'#0f2460', color:'#fff', borderRadius:8, padding:'7px 12px', fontSize:12, pointerEvents:'none', boxShadow:'0 4px 16px rgba(0,0,0,0.3)', fontFamily:'"JetBrains Mono",monospace', lineHeight:1.7 }}>
          <div><b style={{ color:'#60aaff' }}>{hovered.rowLabel}</b></div>
          <div style={{ color:'#a0c0ff', fontSize:10 }}>{hovered.colLabel}</div>
          <div style={{ color:'#ffe000', fontWeight:700, fontSize:14 }}>
            {hovered.value!=null?(Number.isInteger(hovered.value)?hovered.value:hovered.value.toFixed(4)):'—'}
          </div>
          {viewMode==='pa'&&<div style={{ color:'#93b4f0', fontSize:10 }}>{hovered.value>paThreshold?'Present':'Absent'}</div>}
        </div>
      )}
    </div>
  )
}