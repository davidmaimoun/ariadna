import { useMemo } from 'react'
import CommonSidebar from './CommonSidebar'

function MSAInfo({ seqs = [] }) {
  const alnLen = seqs[0]?.seq.length || 0
  const stats = useMemo(() => {
    if (!seqs.length || !alnLen) return null
    const conservation = Array.from({ length: alnLen }, (_, i) => {
      const col = seqs.map(s => s.seq[i]).filter(c => c && c !== '-')
      if (!col.length) return 0
      const freq = {}; col.forEach(c => { freq[c] = (freq[c]||0)+1 })
      return Math.max(...Object.values(freq)) / col.length
    })
    const gapPct = seqs.reduce((n,s) => n + (s.seq.match(/-/g)||[]).length, 0) / (seqs.length * alnLen)
    return { conservation, gapPct }
  }, [seqs, alnLen])

  if (!seqs.length) return <div style={{ padding:16, fontSize:12, color:'var(--txt4)' }}>No sequences loaded</div>

  return (
    <div style={{ padding:14, fontSize:12, color:'var(--txt2)' }}>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontWeight:700, marginBottom:6, color:'var(--txt1)' }}>Alignment</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ color:'var(--txt4)' }}>Sequences</span>
            <span style={{ fontFamily:'monospace', fontWeight:600 }}>{seqs.length}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ color:'var(--txt4)' }}>Length</span>
            <span style={{ fontFamily:'monospace', fontWeight:600 }}>{alnLen.toLocaleString()} bp</span>
          </div>
          {stats && (
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--txt4)' }}>Gap %</span>
              <span style={{ fontFamily:'monospace', fontWeight:600 }}>{(stats.gapPct*100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div>
          <div style={{ fontWeight:700, marginBottom:6, color:'var(--txt1)' }}>Conservation</div>
          <svg width="100%" height="60" style={{ display:'block' }}>
            {stats.conservation.map((v, i) => (
              <rect key={i} x={`${(i/alnLen)*100}%`} y={60-(v*60)} width={`${(1/alnLen)*100}%`} height={v*60}
                fill={v>0.9?'#0a6e40':v>0.7?'#1a56db':v>0.5?'#cc7000':'#ccc'}/>
            ))}
          </svg>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, color:'var(--txt4)', marginTop:2 }}>
            <span>1</span><span>{alnLen}</span>
          </div>
        </div>
      )}

      <div style={{ marginTop:12 }}>
        <div style={{ fontWeight:700, marginBottom:6, color:'var(--txt1)' }}>Sequences</div>
        <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:200, overflow:'auto' }}>
          {seqs.map((s, i) => (
            <div key={i} style={{ display:'flex', gap:6, fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontFamily:'monospace', color:'var(--txt3)', minWidth:20 }}>{i+1}</span>
              <span style={{ color:'var(--txt2)', wordBreak:'break-all' }}>{s.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MSASidebar({ seqs, width = 260 }) {
  return (
    <CommonSidebar color="#1a56db" width={width} sections={[
      { id:'info', label:'Info', content: <MSAInfo seqs={seqs}/> }
    ]}/>
  )
}
