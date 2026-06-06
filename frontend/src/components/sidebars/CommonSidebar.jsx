import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
//  CommonSidebar — collapsible sidebar with tab navigation
//  sections: [{ id, label, content }]
//
//  The toggle is an always-in-flow 14px strip on the left edge, so it stays
//  clickable whether the sidebar is open or closed (never clipped).
// ─────────────────────────────────────────────────────────────────────────────
export default function CommonSidebar({ sections = [], defaultTab, width = 290, color = '#1a56db' }) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState(defaultTab || sections[0]?.id)

  if (!sections.length) return null

  return (
    <div style={{ display:'flex', flexShrink:0, height:'100%' }}>
      {/* Toggle strip — always visible & clickable */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Open panel' : 'Close panel'}
        style={{
          width:16, flexShrink:0, cursor:'pointer', padding:0,
          border:'none', borderLeft:`2px solid ${color}33`,
          background:'var(--bg3)', color: color,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:700,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}>
        {collapsed ? '‹' : '›'}
      </button>

      {/* Panel */}
      {!collapsed && (
        <div style={{ width, display:'flex', flexDirection:'column', background:'var(--panel)', overflow:'hidden' }}>
          {sections.length > 1 && (
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
              {sections.map(s => (
                <button key={s.id} onClick={() => setTab(s.id)} style={{
                  flex:1, padding:'8px 4px', border:'none', background:'none', cursor:'pointer',
                  fontSize:11.5, fontWeight:tab===s.id?700:400,
                  color:tab===s.id?color:'var(--txt3)',
                  borderBottom:tab===s.id?`2px solid ${color}`:'2px solid transparent',
                  transition:'all .15s', whiteSpace:'nowrap',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ flex:1, overflow:'auto' }}>
            {sections.find(s => s.id === tab)?.content}
          </div>
        </div>
      )}
    </div>
  )
}