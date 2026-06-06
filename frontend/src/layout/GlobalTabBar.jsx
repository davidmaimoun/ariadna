import { X, Plus, Dna, AlignJustify, Layers, BarChart3, FileText, GitBranch, Grid3x3, Microscope } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDocStore } from '../store/useDocStore'

// Tool → color + icon + the route base used to navigate to a doc
const TOOL_META = {
  sequence: { color:'#1a56db', Icon:Dna },
  msa:      { color:'#1a56db', Icon:AlignJustify },
  vcf:      { color:'#0e8c9e', Icon:Layers },
  bam:      { color:'#6b40a8', Icon:BarChart3 },
  blast:    { color:'#cc7000', Icon:FileText },
  tree:     { color:'#7c3aed', Icon:GitBranch },
  matrix:   { color:'#d97706', Icon:Grid3x3 },
  sanger:   { color:'#059669', Icon:Microscope },
}

// A single global bar showing EVERY open document across all tools.
export default function GlobalTabBar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const docs      = useDocStore(s => s.docs)        // stable ref
  const removeDoc = useDocStore(s => s.removeDoc)

  if (docs.length === 0) return null

  // Which doc is currently shown? derive from the URL: /tool/docId
  const parts     = location.pathname.split('/').filter(Boolean)
  const activeDocId = parts[1]   // /tool/:docId

  const close = (e, doc) => {
    e.stopPropagation()
    const sameTool = docs.filter(d => d.tool === doc.tool && d.id !== doc.id)
    removeDoc(doc.id)
    if (doc.id === activeDocId) {
      // navigate to another doc (any tool) or home
      const others = docs.filter(d => d.id !== doc.id)
      navigate(others.length ? `/${others[others.length-1].tool}/${others[others.length-1].id}` : '/')
    }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, height:36, flexShrink:0,
      padding:'0 10px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
      {docs.map(d => {
        const meta = TOOL_META[d.tool] || TOOL_META.sequence
        const Icon = meta.Icon
        const active = d.id === activeDocId
        return (
          <button key={d.id} onClick={() => navigate(`/${d.tool}/${d.id}`)}
            title={`${d.tool} · ${d.name}`}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
              borderRadius:'7px 7px 0 0', cursor:'pointer', marginBottom:-1,
              borderTop:`1px solid ${active ? 'var(--border)' : 'transparent'}`,
              borderLeft:`1px solid ${active ? 'var(--border)' : 'transparent'}`,
              borderRight:`1px solid ${active ? 'var(--border)' : 'transparent'}`,
              borderBottom:'none',
              background: active ? '#fff' : 'transparent',
              color: active ? meta.color : 'var(--txt3)',
              fontSize:12, fontWeight: active ? 700 : 500, whiteSpace:'nowrap', maxWidth:190, transition:'all .12s' }}>
            <Icon size={13} style={{ color: meta.color, flexShrink:0 }}/>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</span>
            <span onClick={(e) => close(e, d)}
              style={{ display:'flex', padding:1, borderRadius:3, color:'var(--txt4)' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='#c0300e'}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--txt4)'}}>
              <X size={12}/>
            </span>
          </button>
        )
      })}
      {/* + → home to pick any tool */}
      <button onClick={() => navigate('/')} title="New document"
        style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26,
          borderRadius:6, border:'none', cursor:'pointer', background:'transparent', color:'var(--txt3)', marginLeft:4, flexShrink:0 }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <Plus size={15}/>
      </button>
    </div>
  )
}