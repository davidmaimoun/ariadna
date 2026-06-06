// Contig/sequence selector — shown as a compact bar with a <select> dropdown
import { useStore } from '../../store/useStore'

export default function ContigSelector({ contigs, active, onSelect }) {
  if (!contigs || contigs.length <= 1) return null
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'4px 14px',
      background:'var(--bg3)', borderBottom:'1px solid var(--border)',
      flexShrink:0, height:36,
    }}>
      <span style={{ fontSize:11.5, color:'var(--txt3)', fontWeight:600, whiteSpace:'nowrap' }}>
        📋 {contigs.length} sequences
      </span>
      <select
        value={active}
        onChange={e => onSelect(parseInt(e.target.value))}
        style={{
          flex:1, maxWidth:400, fontSize:12,
          padding:'3px 8px', borderRadius:6,
          border:'1px solid var(--border)',
          background:'#fff', color:'var(--txt)',
          fontFamily:'"JetBrains Mono",monospace',
          cursor:'pointer',
        }}
      >
        {contigs.map((c, i) => (
          <option key={i} value={i}>
            {c.id || c.name || `Sequence ${i+1}`}
            {c.length ? `  (${c.length.toLocaleString()} bp)` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
