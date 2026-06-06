import CommonSidebar from './CommonSidebar'

function EditPanel({ data, editedBases, setEditedBases }) {
  if (!data) return <div style={{ padding:16, fontSize:12, color:'var(--txt4)' }}>No trace loaded</div>
  const bases = editedBases || data.bases.split('')
  const edit = (i, c) => { const b=[...bases]; b[i]=c.toUpperCase(); setEditedBases(b) }
  return (
    <div style={{ padding:12, fontSize:11, overflowY:'auto', maxHeight:'100%' }}>
      <div style={{ fontWeight:700, marginBottom:8, color:'var(--txt1)', fontSize:12 }}>Edit bases</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
        {bases.map((b, i) => (
          <input key={i} value={b} maxLength={1} onChange={e=>edit(i,e.target.value)}
            style={{
              width:18, height:22, textAlign:'center', fontSize:10, fontFamily:'monospace', textTransform:'uppercase',
              border:'1px solid var(--border)', borderRadius:3, padding:0, background:'var(--bg)',
              color:b!==data.bases[i]?'#c0300e':'var(--txt2)',
            }}/>
        ))}
      </div>
    </div>
  )
}

function StatsPanel({ data }) {
  if (!data) return <div style={{ padding:16, fontSize:12, color:'var(--txt4)' }}>No trace loaded</div>
  const qvs = data.qualNums || []
  const avg = qvs.length ? (qvs.reduce((a,b)=>a+b,0)/qvs.length).toFixed(1) : '-'
  const q30 = qvs.length ? ((qvs.filter(q=>q>=30).length/qvs.length)*100).toFixed(1) : '-'
  return (
    <div style={{ padding:12, fontSize:12, color:'var(--txt2)' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:'var(--txt4)' }}>Bases</span><span style={{ fontFamily:'monospace', fontWeight:600 }}>{data.bases.length}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:'var(--txt4)' }}>Avg QV</span><span style={{ fontFamily:'monospace', fontWeight:600 }}>{avg}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:'var(--txt4)' }}>Q30%</span><span style={{ fontFamily:'monospace', fontWeight:600 }}>{q30}%</span>
        </div>
      </div>
      {qvs.length > 0 && (
        <svg width="100%" height="60">
          {qvs.map((q,i) => (
            <rect key={i} x={`${(i/qvs.length)*100}%`} y={60-Math.min(q/50*60,60)} width={`${(1/qvs.length)*100}%`} height={Math.min(q/50*60,60)}
              fill={q>=30?'#0a6e40':q>=20?'#1a56db':q>=10?'#cc7000':'#c0300e'}/>
          ))}
        </svg>
      )}
    </div>
  )
}

export default function SangerSidebar({ data, editedBases, setEditedBases, width = 260 }) {
  return (
    <CommonSidebar color="#059669" width={width} sections={[
      { id:'edit',  label:'Edit',  content: <EditPanel  data={data} editedBases={editedBases} setEditedBases={setEditedBases}/> },
      { id:'stats', label:'Stats', content: <StatsPanel data={data}/> },
    ]}/>
  )
}
