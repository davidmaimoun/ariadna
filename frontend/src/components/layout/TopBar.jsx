import { Dna, Microscope, Grid3x3, GitBranch } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import { TOOL_LIST } from '../../routes/toolRegistry'

const ICONS = { Dna, Microscope, Grid3x3, GitBranch }

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeByTool = useDocStore(s => s.activeByTool)

  const go = (tool) => {
    // If a document is already open for this tool, jump to it; else the picker
    const activeId = activeByTool[tool.id]
    navigate(activeId ? `${tool.path}/${activeId}` : tool.path)
  }

  const isActive = (tool) => location.pathname.startsWith(tool.path)

  return (
    <header style={{
      display:'flex', alignItems:'center', gap:4, padding:'0 14px',
      height:50, flexShrink:0, background:'#fff',
      borderBottom:'1.5px solid var(--border)', boxShadow:'0 2px 8px rgba(20,50,140,.06)',
    }}>
      {/* Logo → home */}
      <div onClick={() => navigate('/')}
        style={{ display:'flex', alignItems:'center', gap:8, marginRight:6, cursor:'pointer', flexShrink:0 }}>
        <svg viewBox="0 0 64 64" width="30" height="30">
          <defs>
            <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2060f0"/><stop offset="100%" stopColor="#0a2fa8"/></linearGradient>
            <linearGradient id="hs1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#90d0ff"/><stop offset="100%" stopColor="#4090ff"/></linearGradient>
            <linearGradient id="hs2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffe84a"/><stop offset="100%" stopColor="#ffb200"/></linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#hbg)"/>
          <path d="M18 6C18 6,46 16,46 32C46 48,18 58,18 58" stroke="url(#hs1)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <path d="M46 6C46 6,18 16,18 32C18 48,46 58,46 58" stroke="url(#hs2)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <line x1="20" y1="13" x2="44" y2="18" stroke="rgba(255,255,255,.65)" strokeWidth="2.8" strokeLinecap="round"/>
          <line x1="20" y1="30" x2="44" y2="30" stroke="rgba(255,255,255,.8)"  strokeWidth="2.8" strokeLinecap="round"/>
          <line x1="20" y1="47" x2="44" y2="52" stroke="rgba(255,255,255,.65)" strokeWidth="2.8" strokeLinecap="round"/>
        </svg>
        <div style={{ lineHeight:1.1 }}>
          <div style={{ fontSize:14, fontWeight:900, letterSpacing:'-.4px',
            background:'linear-gradient(90deg,#1a56db,#00c6ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Aria<span style={{ background:'linear-gradient(90deg,#1a9fff,#00e5ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>DNA</span>
          </div>
          <div style={{ fontSize:9, color:'var(--txt4)' }}>Genomic Viewer</div>
        </div>
      </div>

      <div style={{ width:1, height:26, background:'var(--border)', margin:'0 4px' }}/>

      <nav style={{ display:'flex', alignItems:'center', gap:2 }}>
        {TOOL_LIST.map(tool => {
          const Icon = ICONS[tool.icon]
          const active = isActive(tool)
          return (
            <button key={tool.id} onClick={() => go(tool)} title={tool.label}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 13px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:13, fontWeight:700,
                background: active ? tool.color : 'transparent',
                color: active ? '#fff' : '#4a6080',
                transition:'all .15s',
                boxShadow: active ? `0 2px 10px ${tool.color}44` : 'none',
              }}
              onMouseEnter={e => { if(!active) e.currentTarget.style.background='#f0f4fa' }}
              onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent' }}>
              {Icon && <Icon size={14}/>} {tool.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
