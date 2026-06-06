const DRAW_COLORS = ['#1a56db','#c0300e','#0a6e40','#cc7000','#6b40a8','#0e8c9e','#e05080']

export default function AnnotSidePanel({ annotGroups, setAnnotGroups, drawShape, setDrawShape, activeColor, setActiveColor, opacity, setOpacity, drawMode, setDrawMode }) {

  return (
    <div style={{ padding:'12px 14px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
        Draw annotations
      </div>
      <div style={{ fontSize:11.5, color:'var(--txt3)', marginBottom:12, lineHeight:1.5, background:'var(--bg2)', padding:'8px 10px', borderRadius:7 }}>
        Click <b>✏ Draw mode</b> in the tree toolbar, then drag to draw shapes. Click a shape to label or delete it.
      </div>

      {/* Draw tool */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:'var(--txt2)', marginBottom:6, fontWeight:600 }}>Tool</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {[['ellipse','⬭ Ellipse'],['rect','▭ Rect'],['text','T Text']].map(([id,label])=>(
            <button key={id} onClick={()=>setDrawShape(id)} style={{
              flex:1, padding:'7px 8px', borderRadius:7, cursor:'pointer', fontSize:12,
              border:`2px solid ${drawShape===id?'var(--accent)':'var(--border)'}`,
              background:drawShape===id?'var(--bg3)':'#fff',
              color:drawShape===id?'var(--accent)':'var(--txt3)',
              fontWeight:drawShape===id?700:400,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:'var(--txt2)', marginBottom:6, fontWeight:600 }}>Color</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          {DRAW_COLORS.map(c=>(
            <button key={c} onClick={()=>setActiveColor(c)} style={{
              width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
              outline: activeColor===c?'3px solid #ffe000':'2px solid #fff',
              boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
            }}/>
          ))}
          <input type="color" value={activeColor} onChange={e=>setActiveColor(e.target.value)}
            style={{ width:24, height:24, borderRadius:'50%', padding:0, border:'none', cursor:'pointer' }}/>
        </div>
      </div>

      {/* Opacity */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--txt2)', fontWeight:600, marginBottom:4 }}>
          <span>Fill opacity</span>
          <span style={{ color:'var(--accent)', fontFamily:'monospace' }}>{Math.round(opacity*100)}%</span>
        </div>
        <input type="range" min={0.04} max={0.65} step={0.01} value={opacity}
          onChange={e=>setOpacity(parseFloat(e.target.value))}
          style={{ width:'100%', accentColor:'var(--accent)' }}/>
      </div>

      {/* Existing annotations list */}
      {annotGroups?.length>0&&(
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Annotations ({annotGroups.length})
          </div>
          {annotGroups.map(s=>(
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 0', borderBottom:'1px solid var(--border2)' }}>
              <div style={{ width:12, height:12, borderRadius:s.type==='rect'?3:'50%', background:s.color, flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:11.5, color:'var(--txt)', fontStyle:s.label?'normal':'italic', color:s.label?'var(--txt)':'var(--txt4)' }}>
                {s.label||'(no label)'}
              </span>
              <button onClick={()=>setAnnotGroups(prev=>prev.filter(a=>a.id!==s.id))}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:13, padding:'0 2px' }}>✕</button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ width:'100%', marginTop:8, fontSize:12 }}
            onClick={()=>setAnnotGroups([])}>Clear all</button>
        </>
      )}
    </div>
  )
}



