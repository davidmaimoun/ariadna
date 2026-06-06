import { useRef, useState, useEffect } from 'react'

export default function DrawOverlay({ width, height, shapes, setShapes, drawMode, drawShape, activeColor, opacity }) {
  const svgRef    = useRef()
  const isDrawing = useRef(false)
  const startPt   = useRef(null)
  const [draft,     setDraft]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [textPos,   setTextPos]   = useState(null)
  const dragRef = useRef(null)   // { id, ox, oy, startX, startY, handle } for dragging/resizing

  const getPos = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const src  = e.touches?.[0] ?? e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const onDown = (e) => {
    if (!drawMode) return
    if (drawShape === 'text') { setTextPos(getPos(e)); setSelected(null); return }
    if (e.target !== svgRef.current) return
    e.preventDefault()
    isDrawing.current = true
    startPt.current   = getPos(e)
    setDraft(null); setSelected(null)
  }
  const onMove = (e) => {
    if (!isDrawing.current || !startPt.current) return
    e.preventDefault()
    const p = getPos(e)
    setDraft({ x1:Math.min(startPt.current.x,p.x), y1:Math.min(startPt.current.y,p.y),
               x2:Math.max(startPt.current.x,p.x), y2:Math.max(startPt.current.y,p.y) })
  }
  const onUp = (e) => {
    if (!isDrawing.current || !startPt.current) return
    isDrawing.current = false
    const src  = e.changedTouches?.[0] ?? e
    const rect = svgRef.current.getBoundingClientRect()
    const p    = { x: src.clientX-rect.left, y: src.clientY-rect.top }
    const x1=Math.min(startPt.current.x,p.x), y1=Math.min(startPt.current.y,p.y)
    const x2=Math.max(startPt.current.x,p.x), y2=Math.max(startPt.current.y,p.y)
    startPt.current = null
    if (x2-x1 < 6 && y2-y1 < 6) { setDraft(null); return }
    const s = { id:Date.now(), type:drawShape, x1,y1,x2,y2, color:activeColor, opacity, label:'' }
    setShapes(prev=>[...prev,s])
    setSelected(s.id); setEditLabel('')
    setDraft(null)
  }

  const placeText  = (text) => {
    if (!text?.trim() || !textPos) return
    setShapes(prev=>[...prev,{ id:Date.now(), type:'text', x:textPos.x, y:textPos.y,
      color:activeColor, opacity:1, label:text, fontSize:15 }])
    setTextPos(null)
  }
  const deleteShape = (id) => { setShapes(prev=>prev.filter(s=>s.id!==id)); setSelected(null) }
  const updateLabel = (id, lbl) => {
    setShapes(prev=>prev.map(s=>s.id===id?{...s,label:lbl}:s))
    setEditLabel(lbl)
  }
  const onClickShape = (e, s) => {
    e.stopPropagation()
    if (drawMode) return
    setSelected(s.id); setEditLabel(s.label||'')
  }

  const selShape = shapes.find(s=>s.id===selected)

  const mkShape = (s, transparent=false) => {
    const cx=(s.x1+s.x2)/2, cy=(s.y1+s.y2)/2
    const rx=Math.max(1,(s.x2-s.x1)/2), ry=Math.max(1,(s.y2-s.y1)/2)
    const common = transparent
      ? { fill:'transparent', stroke:'transparent', strokeWidth:12, style:{cursor:'pointer'}, onClick:(e)=>onClickShape(e,s) }
      : { fill:s.color, fillOpacity:s.opacity, stroke:s.color, strokeWidth:selected===s.id?2.5:1.8, strokeOpacity:0.9, style:{cursor:'pointer'}, onClick:(e)=>onClickShape(e,s) }
    return s.type==='rect'
      ? <rect key={s.id+(transparent?'h':'')} x={s.x1} y={s.y1} width={s.x2-s.x1} height={s.y2-s.y1} rx={10} {...common}/>
      : <ellipse key={s.id+(transparent?'h':'')} cx={cx} cy={cy} rx={rx} ry={ry} {...common}/>
  }

  // Attach touchmove with passive:false so preventDefault() works
  useEffect(() => {
    const el = svgRef.current; if (!el) return
    const handler = (e) => { if (isDrawing.current) { e.preventDefault(); onMove(e) } }
    el.addEventListener('touchmove', handler, { passive: false })
    return () => el.removeEventListener('touchmove', handler)
  }, [onMove])

  return (
    <>
      {/* Visual SVG overlay — always visible, pointer events only in draw mode */}
      <svg ref={svgRef} width={width} height={height}
        style={{
          position:'absolute', top:0, left:0, zIndex:10,
          cursor:drawMode?(drawShape==='text'?'text':'crosshair'):'default',
          pointerEvents:drawMode?'all':'none',
          userSelect:'none',
          touchAction:'none',
        }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onTouchStart={onDown} onTouchEnd={onUp}
      >
        {shapes.map(s => s.type==='text' ? (
          <text key={s.id} x={s.x} y={s.y} fill={s.color} fontSize={s.fontSize||15}
            fontWeight={700} fontFamily='"IBM Plex Sans",sans-serif'
            stroke="white" strokeWidth={3} paintOrder="stroke">{s.label}</text>
        ) : (
          <g key={s.id}>
            {mkShape(s)}
            {s.label && (
              <text x={(s.x1+s.x2)/2} y={s.y1-6} textAnchor="middle" fontSize={13}
                fontWeight={700} fontFamily='"IBM Plex Sans",sans-serif'
                fill={s.color} stroke="white" strokeWidth={3} paintOrder="stroke">{s.label}</text>
            )}
            {selected===s.id && (
              <>
                {/* Delete button — in visual layer, always visible */}
                <circle cx={s.x2+6} cy={s.y1-6} r={10} fill="#c0300e" stroke="white" strokeWidth={1.5}
                  style={{cursor:'pointer',pointerEvents:'none'}}/>
                <text x={s.x2+6} y={s.y1-6} textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fill="white" fontWeight={800} style={{pointerEvents:'none'}}>✕</text>
                {/* Resize corner dots — visual only, interaction is in hit-test SVG */}
                {[[s.x1,s.y1],[s.x2,s.y1],[s.x1,s.y2],[s.x2,s.y2]].map(([hx,hy],i)=>(
                  <rect key={i} x={hx-5} y={hy-5} width={10} height={10} rx={2}
                    fill="white" stroke={s.color} strokeWidth={2} style={{pointerEvents:'none'}}/>
                ))}
              </>
            )}
          </g>
        ))}
        {draft && (
          draft.x2-draft.x1>0&&draft.y2-draft.y1>0&&(
            drawShape==='rect'
              ? <rect x={draft.x1} y={draft.y1} width={draft.x2-draft.x1} height={draft.y2-draft.y1}
                  rx={10} fill={activeColor} fillOpacity={0.12} stroke={activeColor} strokeWidth={2} strokeDasharray="8,4"/>
              : <ellipse cx={(draft.x1+draft.x2)/2} cy={(draft.y1+draft.y2)/2}
                  rx={(draft.x2-draft.x1)/2} ry={(draft.y2-draft.y1)/2}
                  fill={activeColor} fillOpacity={0.12} stroke={activeColor} strokeWidth={2} strokeDasharray="8,4"/>
          )
        )}
      </svg>

      {/* Invisible hit-test + drag layer — for clicking/dragging shapes when NOT in draw mode */}
      {!drawMode && shapes.length>0 && (
        <svg width={width} height={height}
          style={{ position:'absolute', top:0, left:0, zIndex:12, pointerEvents:'all',
                   userSelect:'none', background:'transparent', cursor: dragRef.current ? 'grabbing' : 'default' }}
          onClick={(e)=>{ if(e.target.tagName==='svg') setSelected(null) }}
          onMouseMove={(e)=>{
            if (!dragRef.current) return
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX-rect.left, my = e.clientY-rect.top
            const dx = mx - dragRef.current.startX, dy = my - dragRef.current.startY
            const h  = dragRef.current.handle
            setShapes(prev=>prev.map(s=>{
              if (s.id !== dragRef.current.id) return s
              if (s.type==='text') return { ...s, x:dragRef.current.ox+dx, y:dragRef.current.oy+dy }
              if (!h) return { ...s, x1:dragRef.current.ox+dx, y1:dragRef.current.oy+dy,
                            x2:dragRef.current.ox+dx+(dragRef.current.w||0),
                            y2:dragRef.current.oy+dy+(dragRef.current.h||0) }
              // Resize by handle
              const MIN=20
              let {x1,y1,x2,y2} = dragRef.current.orig
              if (h==='nw') { x1=Math.min(x2-MIN,x1+dx); y1=Math.min(y2-MIN,y1+dy) }
              if (h==='ne') { x2=Math.max(x1+MIN,x2+dx); y1=Math.min(y2-MIN,y1+dy) }
              if (h==='sw') { x1=Math.min(x2-MIN,x1+dx); y2=Math.max(y1+MIN,y2+dy) }
              if (h==='se') { x2=Math.max(x1+MIN,x2+dx); y2=Math.max(y1+MIN,y2+dy) }
              return { ...s, x1, y1, x2, y2 }
            }))
          }}
          onMouseUp={()=>{ dragRef.current=null }}
          onMouseLeave={()=>{ dragRef.current=null }}
        >
          {shapes.map(s => {
            const makeDrag = (handle=null) => (e) => {
              e.stopPropagation()
              setSelected(s.id); setEditLabel(s.label||'')
              const rect = e.currentTarget.closest('svg').getBoundingClientRect()
              dragRef.current = {
                id:s.id, handle,
                startX:e.clientX-rect.left, startY:e.clientY-rect.top,
                ox:s.type==='text'?s.x:s.x1, oy:s.type==='text'?s.y:s.y1,
                w:s.type==='text'?0:(s.x2-s.x1), h:s.type==='text'?0:(s.y2-s.y1),
                orig:s.type==='text'?null:{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2},
              }
            }
            const isSel = s.id===selected
            return (
              <g key={s.id}>
                {/* Body — drag to move */}
                {s.type==='text'
                  ? <text x={s.x} y={s.y} fill="transparent" stroke="transparent" strokeWidth={14}
                      fontSize={s.fontSize||15} style={{cursor:'grab'}} onMouseDown={makeDrag()}>{s.label}</text>
                  : s.type==='rect'
                    ? <rect x={s.x1} y={s.y1} width={Math.max(1,s.x2-s.x1)} height={Math.max(1,s.y2-s.y1)}
                        rx={10} fill="transparent" stroke="transparent" strokeWidth={12}
                        style={{cursor:'grab'}} onMouseDown={makeDrag()}/>
                    : <ellipse cx={(s.x1+s.x2)/2} cy={(s.y1+s.y2)/2}
                        rx={Math.max(1,(s.x2-s.x1)/2)} ry={Math.max(1,(s.y2-s.y1)/2)}
                        fill="transparent" stroke="transparent" strokeWidth={12}
                        style={{cursor:'grab'}} onMouseDown={makeDrag()}/>
                }
                {/* Delete + resize handles — only when selected, in interactive layer */}
                {isSel && s.type!=='text' && (
                  <>
                    {/* Delete */}
                    <circle cx={s.x2+6} cy={s.y1-6} r={11} fill="transparent"
                      style={{cursor:'pointer'}} onClick={(e)=>{e.stopPropagation();deleteShape(s.id)}}/>
                    {/* Resize corners */}
                    {[['nw',s.x1,s.y1,'nwse-resize'],['ne',s.x2,s.y1,'nesw-resize'],
                      ['sw',s.x1,s.y2,'nesw-resize'],['se',s.x2,s.y2,'nwse-resize']].map(([h,hx,hy,cur])=>(
                      <rect key={h} x={hx-8} y={hy-8} width={16} height={16}
                        fill="transparent" style={{cursor:cur}}
                        onMouseDown={makeDrag(h)}/>
                    ))}
                  </>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {/* Text placement input */}
      {textPos && drawMode && (
        <div style={{ position:'absolute', left:Math.min(textPos.x,width-250), top:Math.max(4,textPos.y-46),
          zIndex:50, background:'#fff', borderRadius:8, padding:'7px 10px',
          border:`2px solid ${activeColor}`, boxShadow:'0 4px 16px rgba(0,0,0,0.2)',
          display:'flex', gap:6, alignItems:'center',
        }}>
          <input autoFocus type="text" placeholder="Type text…"
            style={{ width:160, fontSize:13, border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', outline:'none' }}
            onKeyDown={e=>{ if(e.key==='Enter') placeText(e.target.value); if(e.key==='Escape') setTextPos(null) }}/>
          <button onClick={e=>placeText(e.currentTarget.previousSibling.value)}
            style={{ background:activeColor, border:'none', color:'#fff', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>✓</button>
          <button onClick={()=>setTextPos(null)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:16 }}>✕</button>
        </div>
      )}

      {/* Label editor for selected shape */}
      {selShape && selShape.type!=='text' && !drawMode && (
        <div style={{
          position:'absolute',
          left: Math.min(Math.max(4,(selShape.x1+selShape.x2)/2-110), width-230),
          top:  Math.max(4, selShape.y1-54),
          zIndex:50, background:'#fff', borderRadius:8, padding:'7px 10px',
          border:`2px solid ${selShape.color}`, boxShadow:'0 4px 18px rgba(0,0,0,0.18)',
          display:'flex', gap:6, alignItems:'center', minWidth:215, pointerEvents:'all',
        }}>
          <input autoFocus type="text" placeholder="Label (ex: ST-123)…"
            value={editLabel}
            onChange={e=>{ setEditLabel(e.target.value); updateLabel(selShape.id, e.target.value) }}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') setSelected(null) }}
            style={{ flex:1, fontSize:12.5, border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', outline:'none' }}/>
          <button onClick={()=>deleteShape(selShape.id)}
            style={{ background:'#c0300e', border:'none', color:'#fff', borderRadius:5, padding:'5px 9px', cursor:'pointer', fontSize:13, fontWeight:700 }}>🗑</button>
          <button onClick={()=>setSelected(null)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:16 }}>✕</button>
        </div>
      )}
    </>
  )
}



// Sidebar panel for annotations
