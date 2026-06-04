import { useStore } from '../store/useStore'

export default function Notification() {
  const { notification } = useStore()
  if (!notification) return null
  const colors = {
    info:    { bg:'#eef3ff', border:'#1a56db', text:'#0f2460' },
    success: { bg:'#eefaf3', border:'#0d6e32', text:'#0a4020' },
    error:   { bg:'#fff0ee', border:'#b34014', text:'#7a2a0a' },
    warning: { bg:'#fffbee', border:'#9a7c10', text:'#5c4a09' },
  }
  const c = colors[notification.type] || colors.info
  return (
    <div className="slide-in" style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background:c.bg, border:`1px solid ${c.border}`,
      borderRadius:8, padding:'10px 16px', color:c.text,
      fontSize:13, fontFamily:'"IBM Plex Sans",sans-serif',
      boxShadow:'0 4px 20px rgba(26,60,140,0.15)', maxWidth:340,
      display:'flex', alignItems:'center', gap:8,
    }}>
      <span style={{ fontSize:16 }}>
        {{ success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' }[notification.type] || 'ℹ️'}
      </span>
      {notification.msg}
    </div>
  )
}
