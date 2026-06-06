import { Dna, Microscope, Grid3x3, GitBranch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TOOL_LIST } from './toolRegistry'

const ICONS = { Dna, Microscope, Grid3x3, GitBranch }

export default function Home() {
  const navigate = useNavigate()
  return (
    <div style={{ height:'100%', overflow:'auto', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:40, background:'var(--bg)' }}>
      <h1 style={{ fontSize:28, fontWeight:900, color:'#0f2460', marginBottom:6 }}>AriaDNA</h1>
      <p style={{ fontSize:14, color:'#5a7ec0', marginBottom:32 }}>Choose a tool to get started</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(220px,1fr))', gap:18, maxWidth:520, width:'100%' }}>
        {TOOL_LIST.map(tool => {
          const Icon = ICONS[tool.icon]
          return (
            <button key={tool.id} onClick={() => navigate(tool.path)}
              style={{
                display:'flex', flexDirection:'column', gap:10, padding:'22px 20px',
                borderRadius:14, textAlign:'left', cursor:'pointer',
                border:`2px solid ${tool.color}22`, background:'#fff', transition:'all .15s',
              }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=tool.color; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 20px ${tool.color}22` }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${tool.color}22`; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
              <div style={{ color:tool.color }}>{Icon && <Icon size={28}/>}</div>
              <div style={{ fontSize:19, fontWeight:800, color:'#0f2460' }}>{tool.label}</div>
              <div style={{ fontSize:13.5, color:'#5a7ec0', lineHeight:1.5 }}>{tool.blurb}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}