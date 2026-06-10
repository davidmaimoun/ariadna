import { Dna, Microscope, Grid3x3, GitBranch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TOOL_LIST } from './toolRegistry'

const ICONS = { Dna, Microscope, Grid3x3, GitBranch }

export default function Home() {
  const navigate = useNavigate()
  return (
    <div style={{ height:'100%', overflow:'auto', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:40, background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:8 }}>
        <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="15" fill="#0a1640"/>
          <path d="M20 8C20 8,46 18,46 32C46 46,20 56,20 56" stroke="#2f7bff" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <path d="M44 8C44 8,18 18,18 32C18 46,44 56,44 56" stroke="#ffb200" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <line x1="22" y1="15" x2="42" y2="19" stroke="rgba(255,255,255,.6)" strokeWidth="2.6" strokeLinecap="round"/>
          <line x1="21" y1="32" x2="43" y2="32" stroke="rgba(255,255,255,.75)" strokeWidth="2.6" strokeLinecap="round"/>
          <line x1="22" y1="49" x2="42" y2="45" stroke="rgba(255,255,255,.6)" strokeWidth="2.6" strokeLinecap="round"/>
        </svg>
        <h1 style={{ fontSize:34, fontWeight:800, letterSpacing:'-.02em', margin:0 }}>
          <span style={{ background:'linear-gradient(90deg,#1a56db,#0ea5d4)', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>Aria</span>
          <span style={{ background:'linear-gradient(90deg,#f0b429,#d97706)', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>DNA</span>
        </h1>
      </div>
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