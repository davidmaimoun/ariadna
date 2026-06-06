import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
//  CommonSidebar — collapsible sidebar with tab navigation
//
//  sections: [{ id, label, content }]
//  defaultTab: id of initially selected tab
// ─────────────────────────────────────────────────────────────────────────────
export default function CommonSidebar({ sections = [], defaultTab, width = 290, color = '#1a56db' }) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState(defaultTab || sections[0]?.id)

  if (!sections.length) return null

  return (
    <div style={{ display:'flex', flexShrink:0, position:'relative' }}>
      {/* Resize-feel left border when open */}
      {!collapsed && (
        <div style={{ width:4, flexShrink:0, background:'var(--border2)', cursor:'default' }}/>
      )}

      {/* Toggle tab — always visible */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Open sidebar' : 'Close sidebar'}
        style={{
          position:'absolute', left:collapsed?0:-12, top:'50%', transform:'translateY(-50%)',
          zIndex:20, width:12, height:40, borderRadius:'4px 0 0 4px',
          background:'var(--bg3)', border:'1px solid var(--border)',
          borderRight:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'var(--txt4)', fontSize:8, padding:0, flexShrink:0,
        }}>
        {collapsed ? '◀' : '▶'}
      </button>

      {/* Sidebar content */}
      {!collapsed && (
        <div style={{ width, display:'flex', flexDirection:'column', background:'var(--panel)', overflow:'hidden', borderLeft:`2px solid ${color}22` }}>
          {/* Tab navigation */}
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

          {/* Tab content */}
          <div style={{ flex:1, overflow:'auto' }}>
            {sections.find(s => s.id === tab)?.content}
          </div>
        </div>
      )}
    </div>
  )
}
