export default function ContigSelector({ contigs, activeIndex, onSelect }) {
  if (!contigs || contigs.length <= 1) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 16px',
      background: '#3659ba',
      borderBottom: '1px solid #1e3e9a',
      flexShrink: 0, overflowX: 'auto',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#b8d0ff', whiteSpace: 'nowrap', flexShrink: 0 }}>
        📋 {contigs.length} sequences
      </span>

      <div style={{ flex: 1, display: 'flex', gap: 7, overflowX: 'auto', padding: '4px 0' }}>
        {contigs.map((s, i) => (
          <button key={i} onClick={() => onSelect(i)} style={{
            padding: '5px 13px', borderRadius: 8,
            border: activeIndex === i ? '2px solid var(--yellow)' : '1.5px solid rgba(255,255,255,0.18)',
            cursor: 'pointer', fontSize: 12,
            fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap',
            background:  activeIndex === i ? 'var(--yellow)'             : 'rgba(255,255,255,0.10)',
            color:       activeIndex === i ? '#0f2460'                    : '#d0e4ff',
            fontWeight:  activeIndex === i ? 700                          : 400,
            transition: 'all .15s',
            boxShadow: activeIndex === i ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}>
            {s.id.length > 28 ? s.id.slice(0, 26) + '…' : s.id}
            <span style={{ marginLeft: 7, opacity: .65, fontSize: 11 }}>
              {s.seq.length.toLocaleString()} bp
            </span>
          </button>
        ))}
      </div>

      {contigs.length > 20 && (
        <select
          value={activeIndex}
          onChange={e => onSelect(parseInt(e.target.value))}
          style={{ fontSize: 12, padding: '5px 9px', borderRadius: 7, background: '#1a3faa', color: '#c0d8ff', border: '1.5px solid #3a6adc', flexShrink: 0 }}
        >
          {contigs.map((s, i) => (
            <option key={i} value={i} style={{ background: '#1a3faa' }}>
              {s.id} ({s.seq.length.toLocaleString()} bp)
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
