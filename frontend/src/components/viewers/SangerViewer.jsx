import SangerToolbar from '../toolbars/SangerToolbar'
import CommonSidebar from '../sidebars/CommonSidebar'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { X, Download, Save, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  AB1 PARSER
// ─────────────────────────────────────────────────────────────────────────────
function r16(b,o)  { return (b[o]<<8|b[o+1])<<16>>16 }
function ru16(b,o) { return (b[o]<<8)|b[o+1] }
function ru32(b,o) { return ((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0 }
function rstr(b,o,n){ return Array.from(b.slice(o,o+n)).map(c=>String.fromCharCode(c)).join('') }

export function parseAB1(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer)
  if (rstr(buf,0,4) !== 'ABIF') throw new Error('Not a valid AB1 file')
  const numEntries = ru32(buf,18), dirOffset = ru32(buf,26)
  const entries = {}
  for (let i=0;i<numEntries;i++) {
    const base=dirOffset+i*28; if(base+28>buf.length) break
    const tag=rstr(buf,base,4), num=ru32(buf,base+4)
    const eLen=ru16(buf,base+10), dLen=ru32(buf,base+12)
    const dOff=dLen<=4?base+20:ru32(buf,base+20)
    entries[`${tag}${num}`]={dOff,dLen,eLen}
  }
  const getI16 = (key) => {
    const e=entries[key]; if(!e) return []
    const out=[]; for(let i=0;i+1<e.dLen;i+=2) out.push(r16(buf,e.dOff+i)); return out
  }
  const getStr = (key) => {
    const e=entries[key]; if(!e) return ''
    const d=buf.slice(e.dOff,e.dOff+e.dLen)
    return d[0]<d.length?rstr(buf,e.dOff+1,d[0]):rstr(buf,e.dOff,d.length)
  }
  const getData = (key) => { const e=entries[key]; return e?buf.slice(e.dOff,e.dOff+e.dLen):null }

  const fwoData = getData('FWO_1')
  const order   = fwoData&&entries['FWO_1']?rstr(buf,entries['FWO_1'].dOff,4):'ACGT'
  const traces  = {}
  for (let i=0;i<4;i++) {
    const base=order[i], raw=getI16(`DATA${9+i}`)
    traces[base] = raw.length?raw:getI16(`DATA${1+i}`)
  }
  const basesRaw = getData('PBAS2')||getData('PBAS1')
  const basesEntry = entries['PBAS2']||entries['PBAS1']
  const bases = basesRaw&&basesEntry?rstr(buf,basesEntry.dOff,basesRaw.length):''
  const peakLocs = getI16('PLOC2').length?getI16('PLOC2'):getI16('PLOC1')
  const qualRaw  = getData('PCON2')||getData('PCON1')
  const quality  = qualRaw?Array.from(qualRaw):[]
  const sampleName = getStr('SMPL1')||getStr('SMPL2')||'Unknown'
  const maxVal = Math.max(1,...Object.values(traces).flatMap(t=>t))
  const norm   = {}
  for (const [base,data] of Object.entries(traces))
    norm[base]=data.map(v=>Math.max(0,(v/maxVal)*1000))
  return { traces:norm, bases, peakLocs, quality, sampleName, traceLen:Math.max(...Object.values(norm).map(t=>t.length)), order, rawBuffer:arrayBuffer }
}

// ─────────────────────────────────────────────────────────────────────────────
//  COLORS
// ─────────────────────────────────────────────────────────────────────────────
const NC = { A:'#12a05c', C:'#e6a000', G:'#1a56db', T:'#d63031', N:'#93b4f0' }
const NB = { A:'#d4f5e6', C:'#fff3cc', G:'#d4e4ff', T:'#ffe0df', N:'#f0f5ff' }

// ─────────────────────────────────────────────────────────────────────────────
//  TRACE CANVAS
// ─────────────────────────────────────────────────────────────────────────────
function TraceCanvas({ data, width, height, viewStart, viewEnd, selectedBase, onBaseClick }) {
  const canvasRef = useRef()
  const { traces, bases, peakLocs, quality } = data
  const editedBases = data._editedBases || bases

  // Layout
  const RULER_H = 28, BASE_H = 30, QUAL_H = 44
  const TRACE_H = Math.max(80, height - RULER_H - BASE_H - QUAL_H - 8)
  const PL = 8
  const TW = width - PL

  const draw = useCallback(() => {
    const cv = canvasRef.current; if(!cv) return
    const dpr = window.devicePixelRatio||1
    cv.width=width*dpr; cv.height=height*dpr
    cv.style.width=width+'px'; cv.style.height=height+'px'
    const ctx=cv.getContext('2d')
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height)

    const span=Math.max(1,viewEnd-viewStart)
    const sx=TW/span
    const toX=s=>PL+(s-viewStart)*sx
    let y=0

    // ── Ruler ──────────────────────────────────────────────────────────────
    ctx.fillStyle='#f0f5ff'; ctx.fillRect(0,y,width,RULER_H)
    ctx.font='10px "JetBrains Mono",monospace'; ctx.fillStyle='#5a7ec0'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    for (let bi=0;bi<editedBases.length;bi++) {
      const s=peakLocs[bi]; if(s===undefined||s<viewStart||s>viewEnd) continue
      const x=toX(s)
      const step=Math.max(1,Math.floor(8/sx))
      if (bi%step===0) {
        ctx.fillStyle='#93b4f0'
        ctx.fillText(bi+1,x,y+RULER_H/2)
      }
      ctx.strokeStyle='#d0dff5'; ctx.lineWidth=0.5
      ctx.beginPath(); ctx.moveTo(x,y+RULER_H-5); ctx.lineTo(x,y+RULER_H); ctx.stroke()
    }
    ctx.strokeStyle='#b8cfef'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(0,y+RULER_H); ctx.lineTo(width,y+RULER_H); ctx.stroke()
    y+=RULER_H

    // ── Trace area ────────────────────────────────────────────────────────
    ctx.fillStyle='#fafcff'; ctx.fillRect(0,y,width,TRACE_H)
    // Grid
    for (const p of [0.25,0.5,0.75]) {
      const gy=y+TRACE_H*(1-p)
      ctx.strokeStyle='#eef3fb'; ctx.lineWidth=0.5
      ctx.beginPath(); ctx.moveTo(PL,gy); ctx.lineTo(width,gy); ctx.stroke()
    }
    // Selected base vertical highlight
    if (selectedBase!==null&&selectedBase!==undefined&&peakLocs[selectedBase]!==undefined) {
      const sx2=toX(peakLocs[selectedBase]), hw=Math.max(6,sx*3)
      ctx.fillStyle='rgba(255,224,0,0.20)'; ctx.fillRect(sx2-hw/2,y,hw,TRACE_H)
      ctx.strokeStyle='rgba(255,193,0,0.6)'; ctx.lineWidth=1
      ctx.beginPath(); ctx.moveTo(sx2,y); ctx.lineTo(sx2,y+TRACE_H); ctx.stroke()
    }
    // Draw traces (G behind, then A T C)
    for (const base of ['G','A','T','C']) {
      const trace=traces[base]; if(!trace?.length) continue
      ctx.strokeStyle=NC[base]; ctx.lineWidth=2; ctx.lineJoin='round'
      ctx.beginPath()
      let first=true
      const s0=Math.max(0,Math.floor(viewStart)-2), s1=Math.min(trace.length-1,Math.ceil(viewEnd)+2)
      for (let s=s0;s<=s1;s++) {
        const px=toX(s), py=y+TRACE_H-(trace[s]||0)/1000*TRACE_H
        if(first){ctx.moveTo(px,py);first=false}else ctx.lineTo(px,py)
      }
      ctx.stroke()
    }
    ctx.strokeStyle='#c0d0e8'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(0,y+TRACE_H); ctx.lineTo(width,y+TRACE_H); ctx.stroke()
    y+=TRACE_H

    // ── Quality bars ───────────────────────────────────────────────────────
    ctx.fillStyle='#f5f8ff'; ctx.fillRect(0,y,width,QUAL_H)
    // QV threshold line at 20
    const q20y = y + QUAL_H - 2 - (20/60)*(QUAL_H-4)
    ctx.strokeStyle='rgba(26,86,219,0.15)'; ctx.lineWidth=1; ctx.setLineDash([4,4])
    ctx.beginPath(); ctx.moveTo(PL,q20y); ctx.lineTo(width,q20y); ctx.stroke()
    ctx.setLineDash([])
    ctx.font='8px "IBM Plex Sans",sans-serif'; ctx.fillStyle='rgba(26,86,219,0.4)'
    ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillText('Q20',PL-1,q20y)

    for (let bi=0;bi<editedBases.length;bi++) {
      const s=peakLocs[bi]; if(s===undefined||s<viewStart||s>viewEnd) continue
      const px=toX(s), qv=quality[bi]||0
      const bh=Math.min(QUAL_H-4,(qv/60)*(QUAL_H-4))
      const bw=Math.max(2,sx*0.75)
      const color = qv>=30?'#0a6e40':qv>=20?'#1a56db':qv>=10?'#cc7000':'#c0300e'
      ctx.fillStyle=color
      ctx.fillRect(px-bw/2, y+QUAL_H-2-bh, bw, bh)
    }
    ctx.strokeStyle='#c0d0e8'; ctx.lineWidth=0.5
    ctx.beginPath(); ctx.moveTo(0,y+QUAL_H); ctx.lineTo(width,y+QUAL_H); ctx.stroke()
    y+=QUAL_H

    // ── Called bases — BIG and visible ────────────────────────────────────
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,y,width,BASE_H)
    // subtle alternating bg
    for (let bi=0;bi<editedBases.length;bi++) {
      const s=peakLocs[bi]; if(s===undefined||s<viewStart||s>viewEnd) continue
      const px=toX(s), bw=Math.max(4,Math.min(sx*0.95,BASE_H-2))
      const base=(editedBases[bi]||'N').toUpperCase()
      const isSel=bi===selectedBase
      const qv=quality[bi]||0
      // pill background
      ctx.fillStyle=isSel?'#ffe000':NB[base]||'#f0f5ff'
      ctx.beginPath()
      const r=Math.min(4,bw/2)
      ctx.roundRect?.(px-bw/2,y+2,bw,BASE_H-4,r) || ctx.rect(px-bw/2,y+2,bw,BASE_H-4)
      ctx.fill()
      // border for low quality
      if (qv<20&&qv>0&&!isSel) {
        ctx.strokeStyle='rgba(204,112,0,0.4)'; ctx.lineWidth=1
        ctx.stroke()
      }
      // letter
      const fs=Math.min(BASE_H-8,Math.max(8,bw*0.8))
      ctx.font=`bold ${fs}px "JetBrains Mono",monospace`
      ctx.fillStyle=isSel?'#7a5500':(NC[base]||'#5a7ec0')
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(base,px,y+BASE_H/2)
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [data,width,height,viewStart,viewEnd,selectedBase])

  useEffect(()=>{requestAnimationFrame(draw)},[draw])

  const handleClick=(e)=>{
    const rect=canvasRef.current.getBoundingClientRect()
    const s=viewStart+((e.clientX-rect.left-PL)/TW)*span
    let near=null,nd=Infinity
    for(let bi=0;bi<peakLocs.length;bi++){const d=Math.abs(peakLocs[bi]-s);if(d<nd){nd=d;near=bi}}
    if(near!==null)onBaseClick?.(near)
  }
  const span=Math.max(1,viewEnd-viewStart)
  return <canvas ref={canvasRef} style={{display:'block',cursor:'crosshair'}} onClick={handleClick}/>
}

// ─────────────────────────────────────────────────────────────────────────────
//  SANGER SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
export function SangerSidePanel({ data, selectedBase, setSelectedBase, editedBases, setEditedBases, onExportAB1 }) {
  const [tab, setTab] = useState('edit')

  const bases  = editedBases||data?.bases||''
  const selNuc = (selectedBase!=null)?( bases[selectedBase]||'N').toUpperCase():null
  const selQV  = (selectedBase!=null)?(data?.quality[selectedBase]||0):null
  const edited = !!editedBases

  const editBase=(nuc)=>{
    const arr=bases.split(''); arr[selectedBase]=nuc; setEditedBases(arr.join(''))
  }
  const deleteBase=()=>{
    const arr=bases.split(''); arr.splice(selectedBase,1); setEditedBases(arr.join(''))
    setSelectedBase(Math.max(0,Math.min(selectedBase,arr.length-1)))
  }
  const insertBase=(nuc)=>{
    const arr=bases.split(''); arr.splice(selectedBase+1,0,nuc); setEditedBases(arr.join(''))
    setSelectedBase(selectedBase+1)
  }

  const qvVals=data?.quality.filter(q=>q>0)||[]
  const avgQV=qvVals.length?(qvVals.reduce((a,b)=>a+b,0)/qvVals.length).toFixed(1):0
  const pct20=qvVals.length?(qvVals.filter(q=>q>=20).length/qvVals.length*100).toFixed(1):0

  return (
    <div style={{width:210,flexShrink:0,background:'#fff',borderLeft:'1.5px solid var(--border)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1.5px solid var(--border)',background:'var(--bg2)',flexShrink:0}}>
        {[['edit','Edit'],['info','Stats']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1,padding:'8px 4px',fontSize:12,fontWeight:600,
            color:tab===id?'var(--accent)':'var(--txt3)',
            background:tab===id?'#fff':'transparent',
            border:'none',borderBottom:`2px solid ${tab===id?'var(--accent)':'transparent'}`,cursor:'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:12}}>
        {tab==='edit'&&(
          <>
            {/* Selected base */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--txt4)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Selected base</div>
              {selNuc?(
                <div style={{padding:'10px 12px',borderRadius:8,background:'#f0f5ff',border:'1px solid var(--border)',textAlign:'center'}}>
                  <div style={{fontSize:32,fontWeight:800,color:NC[selNuc]||'#5a7ec0',fontFamily:'"JetBrains Mono",monospace'}}>{selNuc}</div>
                  <div style={{fontSize:11,color:'var(--txt3)'}}>Position {selectedBase+1}</div>
                  <div style={{fontSize:12,fontWeight:700,color:selQV>=30?'#0a6e40':selQV>=20?'#1a56db':selQV>=10?'#cc7000':'#c0300e'}}>QV {selQV}</div>
                </div>
              ):(
                <div style={{fontSize:11,color:'var(--txt4)',textAlign:'center',padding:14,background:'#f8faff',borderRadius:8,border:'1px dashed var(--border)'}}>
                  Click a base on the trace to select
                </div>
              )}
            </div>

            {selNuc&&(
              <>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--txt4)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:7}}>Replace with</div>
                  <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                    {['A','T','G','C','N'].map(nuc=>(
                      <button key={nuc} onClick={()=>editBase(nuc)} style={{
                        width:36,height:36,borderRadius:8,cursor:'pointer',
                        border:`2px solid ${selNuc===nuc?NC[nuc]:'var(--border)'}`,
                        background:selNuc===nuc?NC[nuc]+'22':'#fff',
                        color:NC[nuc]||'#5a7ec0',fontWeight:800,fontSize:16,
                        fontFamily:'"JetBrains Mono",monospace',transition:'all .12s',
                      }}>{nuc}</button>
                    ))}
                  </div>
                </div>

                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--txt4)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:7}}>Insert after position {selectedBase+1}</div>
                  <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                    {['A','T','G','C'].map(nuc=>(
                      <button key={nuc} onClick={()=>insertBase(nuc)} style={{
                        padding:'5px 10px',borderRadius:6,cursor:'pointer',
                        border:'1.5px solid var(--border)',background:'#f0f5ff',
                        color:NC[nuc]||'#5a7ec0',fontWeight:700,fontFamily:'"JetBrains Mono",monospace',fontSize:13,
                      }}>+{nuc}</button>
                    ))}
                  </div>
                  <button onClick={deleteBase} style={{
                    marginTop:7,width:'100%',padding:'6px',borderRadius:6,
                    border:'1.5px solid #fde0d0',background:'#fff8f6',
                    color:'#c0300e',fontWeight:600,fontSize:12,cursor:'pointer',
                  }}>🗑 Delete this base</button>
                </div>
              </>
            )}

            {/* Save / Export */}
            <div style={{borderTop:'1px solid var(--border2)',paddingTop:12}}>
              {edited&&(
                <div style={{marginBottom:8,padding:'6px 10px',background:'#fff8e6',borderRadius:6,border:'1px solid #ffe0a0',fontSize:11,color:'#996600',textAlign:'center'}}>
                  ✎ {bases.length} bases (edited)
                </div>
              )}
              <button
                onClick={onExportAB1}
                disabled={!edited}
                className={edited?'btn btn-primary':'btn'}
                style={{width:'100%',justifyContent:'center',fontSize:12,marginBottom:6,opacity:edited?1:0.5}}
                title={edited?'Save modified AB1 file':'No modifications to save'}
              >
                <Save size={13}/> {edited?'Save modified AB1':'No edits yet'}
              </button>
              {edited&&(
                <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center',fontSize:12}}
                  onClick={()=>setEditedBases(null)}>↺ Reset all edits</button>
              )}
            </div>
          </>
        )}

        {tab==='info'&&data&&(
          <>
            <div style={{fontSize:10,fontWeight:700,color:'var(--txt4)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Trace info</div>
            {[
              ['Sample',data.sampleName],
              ['Length',bases.length+' bases'],
              ['Trace samples',data.traceLen],
              ['Channels',data.order],
              ['Avg QV',avgQV],
              ['≥ QV20',pct20+'%'],
              ['≥ QV30',(data.quality.filter(q=>q>=30).length/Math.max(1,data.quality.length)*100).toFixed(1)+'%'],
            ].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border2)',fontSize:12}}>
                <span style={{color:'var(--txt3)'}}>{l}</span>
                <span style={{fontWeight:600,color:'var(--txt)'}}>{v}</span>
              </div>
            ))}
            <div style={{marginTop:14}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--txt4)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>QV distribution</div>
              {[[0,'#c0300e'],[10,'#cc7000'],[20,'#1a56db'],[30,'#0a6e40'],[40,'#0a6e40']].map(([thr,color])=>{
                const count=data.quality.filter(q=>q>=thr&&(thr===40||q<thr+10)).length
                const pct=data.quality.length?count/data.quality.length*100:0
                return (
                  <div key={thr} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                    <span style={{fontSize:10,fontFamily:'monospace',color:'var(--txt3)',width:36,flexShrink:0}}>Q{thr}+</span>
                    <div style={{flex:1,height:8,background:'var(--bg2)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{width:pct+'%',height:'100%',background:color,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:10,fontFamily:'monospace',color:'var(--txt3)',width:28,textAlign:'right'}}>{count}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SangerViewer({ files: initialFiles, onClose }) {
  const containerRef = useRef()
  const fileInputRef = useRef()
  const [size,         setSize]         = useState({w:900,h:500})
  const [files,        setFiles]        = useState(initialFiles||[])
  const [active,       setActive]       = useState(0)
  const [viewStart,    setViewStart]    = useState(0)
  const [viewEnd,      setViewEnd]      = useState(500)
  const [selectedBase, setSelectedBase] = useState(null)
  const [editedBases,  setEditedBases]  = useState(null)

  const data = files[active]?.data

  useEffect(()=>{
    const el=containerRef.current; if(!el) return
    const ro=new ResizeObserver(([e])=>setSize({w:Math.floor(e.contentRect.width),h:Math.floor(e.contentRect.height)}))
    ro.observe(el); return()=>ro.disconnect()
  },[])

  useEffect(()=>{
    if(!data) return
    setViewStart(0); setViewEnd(Math.min(500,data.traceLen))
    setSelectedBase(null); setEditedBases(null)
  },[data])

  const loadFiles=async(fileList)=>{
    const loaded=[]
    for (const file of Array.from(fileList)) {
      try { const buf=await file.arrayBuffer(); loaded.push({name:file.name,data:parseAB1(buf)}) }
      catch(e){ console.error('AB1:',file.name,e) }
    }
    if(loaded.length) setFiles(prev=>[...prev,...loaded])
  }

  const doZoom=(factor)=>{
    if(!data) return
    const center=Math.round((viewStart+viewEnd)/2)
    const span=Math.max(50,Math.min(data.traceLen,Math.round((viewEnd-viewStart)*factor)))
    const ns=Math.max(0,Math.min(center-Math.round(span/2),data.traceLen-span))
    setViewStart(ns); setViewEnd(ns+span)
  }
  const panTo=(center)=>{
    if(!data) return
    const span=viewEnd-viewStart
    const ns=Math.max(0,Math.min(center-Math.round(span/2),data.traceLen-span))
    setViewStart(ns); setViewEnd(ns+span)
  }
  const handleWheel=(e)=>{e.preventDefault();doZoom(e.deltaY>0?1.2:0.83)}

  // Export FASTA
  const exportFASTA=()=>{
    const seq=editedBases||data?.bases; if(!seq) return
    const name=files[active]?.name?.replace(/\.ab1$/i,'')||'sanger'
    const lines=[`>${name}${editedBases?' (edited)':''}`]
    for(let i=0;i<seq.length;i+=60)lines.push(seq.slice(i,i+60))
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'}))
    a.download=name+(editedBases?'_edited':'')+'.fasta'; a.click()
  }

  // Save modified AB1 — patch the PBAS2/PBAS1 entry in the raw buffer
  const saveAB1=()=>{
    if(!editedBases||!data?.rawBuffer) return
    const orig  = new Uint8Array(data.rawBuffer)
    const copy  = new Uint8Array(orig) // clone
    // Find PBAS2 or PBAS1 entry and patch the base string bytes
    const numEntries=ru32(orig,18), dirOffset=ru32(orig,26)
    let patched=false
    for(let i=0;i<numEntries;i++){
      const base=dirOffset+i*28; if(base+28>orig.length) break
      const tag=Array.from(orig.slice(base,base+4)).map(c=>String.fromCharCode(c)).join('')
      if(tag==='PBAS'){
        const dLen=ru32(orig,base+12)
        const dOff=dLen<=4?base+20:ru32(orig,base+20)
        const newBases=editedBases.slice(0,dLen)
        for(let j=0;j<dLen;j++) copy[dOff+j]=newBases.charCodeAt(j)||0
        patched=true; break
      }
    }
    if(!patched){alert('Could not locate base sequence in AB1 file'); return}
    const name=(files[active]?.name||'sequence').replace(/\.ab1$/i,'')+'_edited.ab1'
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob([copy],{type:'application/octet-stream'}))
    a.download=name; a.click()
  }

  const visibleBases=useMemo(()=>{
    if(!data) return []
    const bstr=editedBases||data.bases
    return bstr.split('').map((b,i)=>({
      base:b.toUpperCase(),idx:i,
      pos:data.peakLocs[i],qv:data.quality[i]||0,
      visible:data.peakLocs[i]>=viewStart&&data.peakLocs[i]<=viewEnd,
    }))
  },[data,editedBases,viewStart,viewEnd])

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',fontFamily:'"IBM Plex Sans",sans-serif'}}>
      {/* Header */}
      <SangerToolbar
        onClose={onClose}
        files={files}
        active={active}
        onSelectFile={i => { setActive(i); setEditedBases(null) }}
        onExportFASTA={exportFASTA}
        onSaveAB1={saveAB1}
        saveEnabled={!!editedBases}
        editedBases={editedBases}
      />

      {!data?(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f4f7ff'}}>
          <div style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:48,marginBottom:16}}>🧫</div>
            <h3 style={{fontSize:20,fontWeight:700,color:'#0f2460',marginBottom:8}}>Sanger Trace Viewer</h3>
            <p style={{color:'#5a7ec0',marginBottom:24}}>Drop .ab1 files here or click to open</p>
            <button className="btn btn-primary" onClick={()=>fileInputRef.current.click()}>Open .ab1 files</button>
          </div>
        </div>
      ):(
        <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>
          {/* Trace + seq area */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 14px',background:'var(--bg3)',borderBottom:'1px solid var(--border)',flexShrink:0,flexWrap:'wrap'}}>
              <button className="btn-zoom" onClick={()=>doZoom(1.5)} title="Zoom out"><ZoomOut size={15}/></button>
              <button className="btn-zoom" onClick={()=>doZoom(0.67)} title="Zoom in"><ZoomIn size={15}/></button>
              <button className="btn" style={{fontSize:12,padding:'5px 10px'}} onClick={()=>{setViewStart(0);setViewEnd(data.traceLen)}}>All</button>
              <div style={{width:1,height:22,background:'var(--border)'}}/>
              <button className="btn btn-ghost" title="Previous base"
                onClick={()=>{const nb=Math.max(0,(selectedBase||0)-1);setSelectedBase(nb);panTo(data.peakLocs[nb])}}>
                <ChevronLeft size={14}/>
              </button>
              <button className="btn btn-ghost" title="Next base"
                onClick={()=>{const nb=Math.min(data.bases.length-1,(selectedBase||0)+1);setSelectedBase(nb);panTo(data.peakLocs[nb])}}>
                <ChevronRight size={14}/>
              </button>
              <div style={{width:1,height:22,background:'var(--border)'}}/>
              <span style={{fontSize:12,color:'var(--txt2)',fontFamily:'monospace',fontWeight:600}}>{data.sampleName}</span>
              <span style={{fontSize:12,color:'var(--txt4)',fontFamily:'monospace'}}>
                {(editedBases||data.bases).length} bases · {data.traceLen} samples
                {editedBases&&<span style={{color:'#cc7000',marginLeft:6}}>✎ edited</span>}
              </span>
              <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:10,color:'var(--txt4)',fontFamily:'monospace',whiteSpace:'nowrap'}}>{(viewStart+1).toLocaleString()}</span>
                <input type="range" min={0} max={Math.max(0,data.traceLen-(viewEnd-viewStart))}
                  value={viewStart}
                  onChange={e=>{const ns=parseInt(e.target.value);setViewStart(ns);setViewEnd(ns+(viewEnd-viewStart))}}
                  style={{flex:1,accentColor:'var(--accent)'}}/>
                <span style={{fontSize:10,color:'var(--txt4)',fontFamily:'monospace',whiteSpace:'nowrap'}}>{data.traceLen.toLocaleString()}</span>
              </div>
            </div>

            {/* Canvas */}
            <div ref={containerRef} style={{flex:1,overflow:'hidden'}} onWheel={handleWheel}>
              <TraceCanvas
                data={{...data,_editedBases:editedBases}}
                width={size.w} height={Math.max(220,size.h-50)}
                viewStart={viewStart} viewEnd={viewEnd}
                selectedBase={selectedBase} onBaseClick={setSelectedBase}
              />
            </div>

            {/* Sequence strip — big, colored, visible */}
            <div style={{
              flexShrink:0, background:'#f0f5ff',
              borderTop:'2px solid var(--border)',
              display:'flex', overflowX:'auto',
              minHeight:46,
            }}>
              {visibleBases.filter(b=>b.visible).map(b=>(
                <div key={b.idx} onClick={()=>setSelectedBase(b.idx)}
                  title={`${b.base} pos ${b.idx+1} QV${b.qv}`}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    minWidth:18, cursor:'pointer', flexShrink:0,
                    background: b.idx===selectedBase ? '#ffe000'
                      : b.qv>=20 ? (NB[b.base]||'#f0f5ff')
                      : '#fff3e0',
                    borderRight:'1px solid rgba(0,0,0,0.04)',
                    transition:'background .08s',
                  }}>
                  <span style={{
                    fontFamily:'"JetBrains Mono",monospace',
                    fontSize:14, fontWeight:800, lineHeight:1,
                    color: b.idx===selectedBase ? '#7a5500' : (NC[b.base]||'#5a7ec0'),
                    opacity: b.qv<10 ? 0.4 : 1,
                  }}>{b.base}</span>
                  {/* tiny QV bar under each base */}
                  <div style={{
                    width:'80%', height:3, borderRadius:2, marginTop:2,
                    background: b.qv>=30?'#0a6e40':b.qv>=20?'#1a56db':b.qv>=10?'#cc7000':'#c0300e',
                    opacity: Math.max(0.15, b.qv/60),
                  }}/>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar — common closable base, rich Sanger content inside */}
          <CommonSidebar color="#059669" width={280} sections={[
            { id:'trace', label:'Trace', content:
              <SangerSidePanel
                data={data}
                selectedBase={selectedBase}
                setSelectedBase={setSelectedBase}
                editedBases={editedBases}
                setEditedBases={setEditedBases}
                onExportAB1={saveAB1}
              />
            }
          ]}/>
        </div>
      )}
    </div>
  )
}