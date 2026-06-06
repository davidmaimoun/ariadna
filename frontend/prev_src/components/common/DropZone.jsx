import { useState } from 'react'

export default function DropZone({ onFile }) {
  const [drag, setDrag] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  const handlePaste = (text) => {
    const blob = new Blob([text], { type: 'text/plain' })
    onFile(new File([blob], 'pasted.fasta', { type: 'text/plain' }))
  }

  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:"var(--bg)", height:'100%' }}>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        style={{
          width:560, borderRadius:16,
          border:`2px dashed ${drag ? "var(--accent)" : "var(--txt4)"}`,
          padding:48, textAlign:'center',
          background: drag ? 'rgba(26,86,219,0.04)' : "var(--panel)",
          boxShadow: drag ? '0 0 0 4px rgba(26,86,219,0.10)' : '0 4px 24px rgba(26,60,140,0.10)',
          transition:'all 0.2s',
        }}
      >
        <div style={{ fontSize:56, marginBottom:16, lineHeight:1 }}>🧬</div>
        <h2 style={{ fontSize:22, fontWeight:700, color:"var(--txt)", margin:'0 0 8px', fontFamily:'"IBM Plex Sans",sans-serif' }}>
          BioViewer
        </h2>
        <p style={{ color:"var(--txt3)", marginBottom:28, fontSize:14, margin:'0 0 28px', lineHeight:1.6 }}>
          Drop a sequence file here, or click <strong>Open file</strong> in the toolbar.<br/>
          Also supports <strong>MSA files</strong> for multiple alignment display.
        </p>

        <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:28 }}>
          {[
            { fmt:'FASTA',    color:"var(--accent)" },
            { fmt:'FASTQ',    color:'#0e8c9e' },
            { fmt:'GenBank',  color:'#1a4fa8' },
            { fmt:'GFF3',     color:'#5a3a9c' },
            { fmt:'BED',      color:'#0e7a8a' },
            { fmt:'GTF',      color:'#1a7a94' },
            { fmt:'MSA/.aln', color:'#b34014' },
          ].map(({ fmt, color }) => (
            <span key={fmt} style={{ padding:'3px 12px', borderRadius:12, fontSize:11, fontWeight:600, background:color+'15', border:`1px solid ${color}55`, color, fontFamily:'"JetBrains Mono",monospace' }}>
              {fmt}
            </span>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:28 }}>
          {[
            { icon:'⚡', title:'Streaming parser',  desc:'Files up to several GB' },
            { icon:'🎯', title:'Virtual rendering', desc:'Canvas 2D, zero lag' },
            { icon:'🔬', title:'Multi-tracks',      desc:'CDS, exon, gene, UTR…' },
            { icon:'🧩', title:'MSA Viewer',        desc:'Multiple sequence alignments' },
          ].map(f => (
            <div key={f.title} style={{ padding:'10px 14px', background:"var(--bg)", borderRadius:10, border:'1px solid #c0d4f5', textAlign:'left' }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{f.icon}</div>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--txt)", marginBottom:2 }}>{f.title}</div>
              <div style={{ fontSize:11, color:"var(--txt3)" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop:'1px solid #c0d4f5', paddingTop:20 }}>
          <p style={{ color:"var(--txt4)", fontSize:12, marginBottom:10 }}>Or paste a FASTA sequence directly:</p>
          <textarea
            placeholder={'>sequence_id description\nATGCGATCGATCGATCGATCGATCG…'}
            style={{ width:'100%', height:80, background:'#f8faff', border:'1px solid #93b4f0', borderRadius:8, color:"var(--txt)", padding:'8px 10px', fontSize:11, fontFamily:'"JetBrains Mono",monospace', resize:'none', outline:'none', lineHeight:1.6 }}
            onKeyDown={e => { if (e.key==='Enter' && e.ctrlKey) handlePaste(e.target.value) }}
            onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow='0 0 0 3px rgba(26,86,219,0.10)' }}
            onBlur={e => { e.target.style.borderColor="var(--txt4)"; e.target.style.boxShadow='none' }}
          />
          <p style={{ color:"var(--txt4)", fontSize:11, marginTop:6 }}>Ctrl+Enter to load</p>
        </div>
      </div>
    </div>
  )
}
