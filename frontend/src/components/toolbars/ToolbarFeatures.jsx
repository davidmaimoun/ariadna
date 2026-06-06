import { ZoomIn, ZoomOut, Search, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Sep — vertical separator with breathing room ───────────────────────────
export function Sep() {
  return <div style={{ width:1, height:26, background:'var(--border)', margin:'0 14px', flexShrink:0 }}/>
}

// ── ToolbarBtn — styled button (active/disabled states) ───────────────────
export function ToolbarBtn({ onClick, disabled, active, color='var(--txt2)', title, children, style={} }) {
  const c = active ? (color === 'var(--txt2)' ? '#1a56db' : color) : color
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      display:'flex', alignItems:'center', gap:4,
      padding:'4px 11px', borderRadius:7,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1.5px solid ${active ? c : 'var(--border)'}`,
      background: active ? c : 'transparent',
      color: active ? '#fff' : disabled ? 'var(--txt4)' : 'var(--txt2)',
      fontSize:12, fontWeight:600, whiteSpace:'nowrap', flexShrink:0,
      transition:'all .15s', opacity: disabled ? .45 : 1,
      ...style,
    }}
    onMouseEnter={e => { if (!disabled && !active) { e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.borderColor='var(--border2)' } }}
    onMouseLeave={e => { if (!disabled && !active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--border)' } }}
    >
      {children}
    </button>
  )
}

// ── ZoomBtns — out + in pair ───────────────────────────────────────────────
export function ZoomBtns({ onIn, onOut, onReset, resetLabel = 'All' }) {
  return (
    <>
      <ToolbarBtn onClick={onOut} title="Zoom out" style={{ padding:'4px 8px' }}><ZoomOut size={13}/></ToolbarBtn>
      <ToolbarBtn onClick={onIn}  title="Zoom in"  style={{ padding:'4px 8px' }}><ZoomIn  size={13}/></ToolbarBtn>
      {onReset && <ToolbarBtn onClick={onReset}>{resetLabel}</ToolbarBtn>}
    </>
  )
}

// ── SearchBox — input + optional prev/next nav ─────────────────────────────
export function SearchBox({ value, onChange, onNext, onPrev, resultCount, resultIndex, placeholder = 'Search…', width = 140 }) {
  return (
    <>
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <Search size={11} style={{ position:'absolute', left:7, color:'var(--txt4)', pointerEvents:'none' }}/>
        <input type="text" placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onNext?.()}
          style={{ width, paddingLeft:24, paddingRight:6, height:28, fontSize:11.5, borderRadius:7, border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--txt2)', outline:'none' }}/>
      </div>
      {resultCount > 0 && (
        <>
          <span style={{ fontSize:10.5, color:'var(--txt3)', fontFamily:'monospace', flexShrink:0 }}>
            {(resultIndex ?? 0) + 1}/{resultCount}
          </span>
          {onPrev && <ToolbarBtn onClick={onPrev} style={{ padding:'4px 7px' }}><ChevronLeft  size={12}/></ToolbarBtn>}
          {onNext && <ToolbarBtn onClick={onNext} style={{ padding:'4px 7px' }}><ChevronRight size={12}/></ToolbarBtn>}
        </>
      )}
    </>
  )
}

// ── ToolbarSelect — styled native select ──────────────────────────────────
export function ToolbarSelect({ value, onChange, options = [], label, style = {} }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
      {label && <span style={{ fontSize:11, color:'var(--txt4)', whiteSpace:'nowrap' }}>{label}</span>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        fontSize:12, padding:'3px 8px', borderRadius:6,
        border:'1.5px solid var(--border)', background:'var(--bg)',
        color:'var(--txt2)', cursor:'pointer', ...style,
      }}>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  )
}

// ── StatBadge — monospace info pill ───────────────────────────────────────
export function StatBadge({ children }) {
  return (
    <span style={{
      fontSize:11, fontFamily:'monospace', color:'var(--txt3)',
      background:'var(--bg2)', padding:'2px 8px',
      borderRadius:20, border:'1px solid var(--border)', flexShrink:0,
    }}>
      {children}
    </span>
  )
}
