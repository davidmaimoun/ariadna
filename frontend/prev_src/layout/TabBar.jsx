import { X, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDocStore } from '../store/useDocStore'

export default function TabBar({ tool, color, activeId }) {
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)        // stable reference
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs      = allDocs.filter(d => d.tool === tool)
  const toolPath  = `/${tool}`

  if (docs.length === 0) return null

  const close = (e, id) => {
    e.stopPropagation()
    const remaining = docs.filter(d => d.id !== id)
    removeDoc(id)
    if (id === activeId)
      navigate(remaining.length ? `${toolPath}/${remaining[remaining.length-1].id}` : toolPath)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:2, height:34, flexShrink:0,
      padding:'0 8px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
      {docs.map(d => {
        const active = d.id === activeId
        return (
          <button key={d.id} onClick={() => navigate(`${toolPath}/${d.id}`)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
              borderRadius:'6px 6px 0 0', cursor:'pointer',
              border:'1px solid', borderColor: active ? 'var(--border)' : 'transparent', borderBottom:'none',
              background: active ? '#fff' : 'transparent', color: active ? color : 'var(--txt3)',
              fontSize:12, fontWeight: active ? 700 : 500, whiteSpace:'nowrap', maxWidth:200, marginBottom:-1, transition:'all .12s' }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</span>
            <span onClick={(e) => close(e, d.id)}
              style={{ display:'flex', padding:1, borderRadius:3, color:'var(--txt4)' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='#c0300e'}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--txt4)'}}>
              <X size={12}/>
            </span>
          </button>
        )
      })}
      <button onClick={() => navigate(toolPath)} title="New"
        style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26,
          borderRadius:6, border:'none', cursor:'pointer', background:'transparent', color:'var(--txt3)', marginLeft:4 }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <Plus size={15}/>
      </button>
    </div>
  )
}
