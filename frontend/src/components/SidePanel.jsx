import { useState } from 'react'
import { useStore } from '../store/useStore'
import { translate, reverseComplement, calcGCContent, findORFs, getFeatureColor } from '../utils/bioUtils'

export default function SidePanel({ width = 300 }) {
  const {
    sequenceMeta, sequence, editedSequence, annotations, annotationFiles,
    selection, selectionText, viewStart, viewEnd,
    visibleTracks, toggleTrack,
    showComplement, showAminoAcids, showGCContent, toggleOption, jumpTo,
    applyEdit, history, historyIndex, undo, redo,
    activePanel, setActivePanel, notify,
  } = useStore()

  const seq      = editedSequence || sequence || ''
  const isEdited = !!editedSequence

  const tabs = [
    { id:'info',     label:'Info' },
    { id:'edit',     label:'Edit' },
    { id:'annots',   label:`Tracks${annotations.length?` (${annotations.length})`:''}` },
    { id:'analysis', label:'Analysis' },
  ]

  return (
    <div style={{ width, flexShrink:0, display:'flex', flexDirection:'column', height:'100%', background:'#ffffff', overflow:'hidden' }}>
      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #aed4bb', background:'#f0f5ff', flexShrink:0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActivePanel(t.id)} style={{
            flex:1, padding:'9px 4px', fontSize:12, fontWeight:600,
            fontFamily:'"IBM Plex Sans",sans-serif',
            color: activePanel===t.id ? '#1a56db' : '#5a7ec0',
            background: activePanel===t.id ? '#ffffff' : 'transparent',
            border:'none', borderBottom: activePanel===t.id ? '2px solid #0d6e32' : '2px solid transparent',
            cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:12 }}>
        {activePanel==='info'     && <InfoPanel     meta={sequenceMeta} seq={seq} isEdited={isEdited} viewStart={viewStart} viewEnd={viewEnd} selection={selection} selectionText={selectionText} showComplement={showComplement} showAminoAcids={showAminoAcids} showGCContent={showGCContent} toggleOption={toggleOption} />}
        {activePanel==='edit'     && <EditPanel     seq={seq} selection={selection} selectionText={selectionText} applyEdit={applyEdit} undo={undo} redo={redo} history={history} historyIndex={historyIndex} notify={notify} />}
        {activePanel==='annots'   && <AnnotsPanel   annotations={annotations} annotationFiles={annotationFiles} visibleTracks={visibleTracks} toggleTrack={toggleTrack} jumpTo={jumpTo} />}
        {activePanel==='analysis' && <AnalysisPanel seq={seq} selection={selection} selectionText={selectionText} notify={notify} />}
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom:16 }}>
      <button onClick={() => setOpen(o=>!o)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:'#2e50a0', background:'none', border:'none', cursor:'pointer', padding:'4px 0', marginBottom:6, textTransform:'uppercase', fontFamily:'"IBM Plex Sans",sans-serif' }}>
        <span>{title}</span><span style={{ fontSize:9, opacity:0.7 }}>{open?'▲':'▼'}</span>
      </button>
      {open && children}
    </div>
  )
}

function Stat({ label, value, mono, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid #eef3ff' }}>
      <span style={{ fontSize:12, color:'#5a7ec0', fontFamily:'"IBM Plex Sans",sans-serif' }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color:color||'#0f2460', fontFamily:mono?'"JetBrains Mono",monospace':'"IBM Plex Sans",sans-serif' }}>{value}</span>
    </div>
  )
}

function Toggle({ label, value, onToggle }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0' }}>
      <span style={{ fontSize:12, color:'#1a3faa' }}>{label}</span>
      <button onClick={onToggle} style={{ width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative', background:value?'#1a56db':'#c0d4f5', transition:'background 0.2s' }}>
        <div style={{ position:'absolute', top:3, left:value?18:3, width:12, height:12, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s' }} />
      </button>
    </div>
  )
}

function InfoPanel({ meta, seq, isEdited, viewStart, viewEnd, selection, selectionText, showComplement, showAminoAcids, showGCContent, toggleOption }) {
  if (!meta) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:12, color:'#5a7ec0' }}>
      <span style={{ fontSize:36 }}>🧬</span>
      <p style={{ fontSize:12, textAlign:'center', margin:0, lineHeight:1.5 }}>Open a FASTA, FASTQ, or GenBank file to get started</p>
    </div>
  )
  const gc = calcGCContent(seq.slice(0,500000)).toFixed(1)
  return (
    <>
      <Section title="Sequence">
        <Stat label="ID"         value={meta.id} />
        <Stat label="Length"     value={meta.length?.toLocaleString()+' bp'} mono />
        <Stat label="Type"       value={meta.type||'DNA'} />
        <Stat label="Format"     value={meta.format?.toUpperCase()} />
        <Stat label="GC content" value={gc+'%'} color="#0d6e32" />
        <Stat label="Parse time" value={meta.parseTime+'s'} />
        {isEdited && <Stat label="Status" value="✎ Edited" color="#b34014" />}
        {meta.description && meta.description!==meta.id && (
          <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'#f0f5ff', border:'1px solid #c0d4f5', fontSize:11, color:'#1a3faa', fontFamily:'"JetBrains Mono",monospace', wordBreak:'break-all', lineHeight:1.5 }}>
            {meta.description.slice(0,200)}
          </div>
        )}
      </Section>
      <Section title="Display options">
        <Toggle label="Complementary strand" value={showComplement}  onToggle={() => toggleOption('showComplement')} />
        <Toggle label="Amino acids (3 frames)" value={showAminoAcids} onToggle={() => toggleOption('showAminoAcids')} />
        <Toggle label="GC content track"     value={showGCContent}   onToggle={() => toggleOption('showGCContent')} />
      </Section>
      {selection && selectionText && (
        <Section title="Selection">
          <Stat label="Start"  value={(selection.start+1).toLocaleString()} mono />
          <Stat label="End"    value={(selection.end+1).toLocaleString()} mono />
          <Stat label="Length" value={selectionText.length.toLocaleString()+' bp'} mono />
          <Stat label="GC %"   value={calcGCContent(selectionText).toFixed(1)+'%'} color="#0d6e32" />
          <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'#f0f5ff', border:'1px solid #c0d4f5', fontSize:12, color:'#1a56db', fontFamily:'"JetBrains Mono",monospace', wordBreak:'break-all', maxHeight:72, overflowY:'auto', letterSpacing:1 }}>
            {selectionText.slice(0,300)}{selectionText.length>300?'…':''}
          </div>
          <div style={{ marginTop:4, padding:'5px 8px', borderRadius:6, background:'#fce0d0', border:'1px solid #f0b898', fontSize:11, color:'#c0300e', fontFamily:'"JetBrains Mono",monospace', wordBreak:'break-all', letterSpacing:1 }}>
            RC: {reverseComplement(selectionText).slice(0,120)}{selectionText.length>120?'…':''}
          </div>
        </Section>
      )}
      <Section title="Viewport">
        <Stat label="Start" value={(viewStart+1).toLocaleString()} mono />
        <Stat label="End"   value={viewEnd.toLocaleString()} mono />
        <Stat label="Span"  value={(viewEnd-viewStart).toLocaleString()+' bp'} mono />
      </Section>
    </>
  )
}

function EditPanel({ seq, selection, selectionText, applyEdit, undo, redo, history, historyIndex, notify }) {
  const [editText,   setEditText]   = useState('')
  const [insertPos,  setInsertPos]  = useState('')
  const [insertText, setInsertText] = useState('')

  const doReplace = () => {
    if (!selection||!editText) { notify('Select a region first','error'); return }
    applyEdit('replace',{ start:selection.start, end:selection.end, text:editText.toUpperCase() })
    notify(`Replaced ${selection.end-selection.start+1} bp`); setEditText('')
  }
  const doInsert = () => {
    const pos = parseInt(insertPos)-1
    if (isNaN(pos)||!insertText) { notify('Enter position and sequence','error'); return }
    applyEdit('insert',{ pos, text:insertText.toUpperCase() })
    notify(`Inserted ${insertText.length} bp at position ${pos+1}`); setInsertText(''); setInsertPos('')
  }
  const doDelete = () => {
    if (!selection) { notify('Select a region first','error'); return }
    if (!confirm(`Delete ${selection.end-selection.start+1} bp?`)) return
    applyEdit('delete',{ start:selection.start, end:selection.end }); notify('Region deleted')
  }

  return (
    <>
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        <button className="btn" style={{ flex:1 }} onClick={undo} disabled={historyIndex<0}>↩ Undo</button>
        <button className="btn" style={{ flex:1 }} onClick={redo} disabled={historyIndex>=history.length-1}>↪ Redo</button>
      </div>
      <Section title="Replace selection">
        {selection
          ? <div style={{ fontSize:12, fontFamily:'monospace', color:'#1a3faa', marginBottom:6, background:'#f0f5ff', padding:'3px 7px', borderRadius:5 }}>{(selection.start+1).toLocaleString()}–{(selection.end+1).toLocaleString()} ({selectionText?.length} bp)</div>
          : <div style={{ fontSize:12, color:'#93b4f0', marginBottom:6 }}>Drag on canvas to select a region</div>
        }
        <textarea value={editText} onChange={e=>setEditText(e.target.value)} placeholder="New sequence (ACGT…)"
          style={{ width:'100%', minHeight:56, resize:'vertical', fontFamily:'"JetBrains Mono",monospace', fontSize:12, marginBottom:6 }} />
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={doReplace} disabled={!selection}>Replace</button>
          <button className="btn btn-danger" onClick={doDelete} disabled={!selection}>Delete</button>
        </div>
      </Section>
      <Section title="Insert sequence">
        <div style={{ display:'flex', gap:6, marginBottom:6 }}>
          <input type="number" placeholder="Position" value={insertPos} onChange={e=>setInsertPos(e.target.value)} style={{ width:80 }} />
          <input type="text" placeholder="Sequence" value={insertText} onChange={e=>setInsertText(e.target.value)} style={{ flex:1 }} />
        </div>
        <button className="btn btn-primary" style={{ width:'100%' }} onClick={doInsert}>Insert</button>
      </Section>
      <Section title="Edit history" defaultOpen={false}>
        {history.length===0
          ? <div style={{ fontSize:12, color:'#93b4f0' }}>No edits yet</div>
          : history.slice().reverse().map((h,i) => (
              <div key={i} style={{ fontSize:12, padding:'4px 7px', borderRadius:5, marginBottom:4, background:'#f0f5ff', border:'1px solid #c0d4f5', opacity:i>historyIndex?0.4:1, fontFamily:'"JetBrains Mono",monospace' }}>
                <span style={{ color:'#1a56db' }}>{h.type}</span>
                <span style={{ color:'#5a7ec0' }}> @{(h.payload.start||h.payload.pos||0)+1}</span>
                {h.payload.text && <span style={{ color:'#c0300e' }}> +{h.payload.text.length}bp</span>}
              </div>
            ))
        }
      </Section>
    </>
  )
}

function AnnotsPanel({ annotations, annotationFiles, visibleTracks, toggleTrack, jumpTo }) {
  const trackTypes = [...new Set(annotations.map(f=>f.type))]
  const [filter, setFilter] = useState('')
  const filtered = filter
    ? annotations.filter(f=>f.type.toLowerCase().includes(filter.toLowerCase())||f.id?.toLowerCase().includes(filter.toLowerCase())||Object.values(f.qualifiers||{}).some(v=>String(v).toLowerCase().includes(filter.toLowerCase())))
    : annotations

  return (
    <>
      {annotationFiles.length>0 && (
        <Section title="Loaded files">
          {annotationFiles.map((f,i) => (
            <div key={i} style={{ fontSize:12, padding:'3px 0', color:'#1a3faa', display:'flex', gap:6 }}>
              <span style={{ color:'#1a56db', fontWeight:700 }}>✓</span> {f}
            </div>
          ))}
        </Section>
      )}
      <Section title="Track visibility">
        {trackTypes.length===0
          ? <div style={{ fontSize:12, color:'#93b4f0', lineHeight:1.6 }}>Load a GFF3, BED, or GTF file using the Annotations button.</div>
          : trackTypes.map(type => (
              <div key={type} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #eef3ff' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:getFeatureColor(type), flexShrink:0 }} />
                  <span style={{ fontSize:12, fontFamily:'"JetBrains Mono",monospace', color:'#0f2460' }}>{type}</span>
                  <span className="badge">{annotations.filter(f=>f.type===type).length}</span>
                </div>
                <input type="checkbox" checked={visibleTracks.has(type)} onChange={() => toggleTrack(type)} style={{ accentColor:'#1a56db', width:14, height:14, cursor:'pointer' }} />
              </div>
            ))
        }
      </Section>
      {annotations.length>0 && (
        <Section title={`Features (${filtered.length})`}>
          <input type="text" placeholder="Filter…" value={filter} onChange={e=>setFilter(e.target.value)} style={{ width:'100%', marginBottom:8, fontSize:11 }} />
          <div style={{ maxHeight:280, overflowY:'auto' }}>
            {filtered.slice(0,300).map((feat,i) => (
              <div key={i} onClick={() => jumpTo(Math.round((feat.start+feat.end)/2))}
                style={{ display:'flex', gap:8, padding:'4px', borderBottom:'1px solid #eef3ff', cursor:'pointer', borderRadius:4, transition:'background 0.1s' }}
                onMouseEnter={e=>e.currentTarget.style.background='#f0f5ff'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ width:8, height:8, borderRadius:2, background:feat.color||'#5a7ec0', flexShrink:0, marginTop:3 }} />
                <div>
                  <div style={{ fontSize:12, fontFamily:'"JetBrains Mono",monospace', color:'#0f2460', fontWeight:600 }}>{feat.qualifiers?.Name||feat.qualifiers?.gene||feat.id||'—'}</div>
                  <div style={{ fontSize:11, color:'#5a7ec0' }}>{feat.type} · {(feat.start+1).toLocaleString()}–{(feat.end+1).toLocaleString()} · {feat.strand===-1?'−':'+'}</div>
                </div>
              </div>
            ))}
            {filtered.length>300 && <div style={{ fontSize:12, color:'#93b4f0', padding:'6px 0', textAlign:'center' }}>…and {filtered.length-300} more. Use the filter.</div>}
          </div>
        </Section>
      )}
    </>
  )
}

function AnalysisPanel({ seq, selection, selectionText, notify }) {
  const [orfs, setOrfs]     = useState([])
  const [running, setRunning] = useState(false)
  const [minORF, setMinORF]   = useState(100)
  const target = selectionText || seq

  const runORF = () => {
    if (!target) return
    setRunning(true)
    setTimeout(() => { const f=findORFs(target,minORF); setOrfs(f); setRunning(false); notify(`${f.length} ORFs found`) }, 50)
  }

  const gc   = target ? calcGCContent(target).toFixed(1) : '--'
  const atgc = target ? [...target.toUpperCase()].reduce((a,c)=>{a[c]=(a[c]||0)+1;return a},{}) : {}
  const tot  = target?.length || 1
  const bars = { A:'#1a56db', T:'#c0300e', G:'#1a4f9c', C:'#7a6200' }

  return (
    <>
      <Section title="Composition">
        <Stat label="Target"     value={selectionText?'Selection':'Full sequence'} />
        <Stat label="GC content" value={gc+'%'} color="#0d6e32" />
        {['A','T','G','C'].map(n => (
          <div key={n} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
            <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:12, fontWeight:800, color:bars[n], width:14 }}>{n}</span>
            <div style={{ flex:1, height:7, background:'#dce8fb', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:target?((atgc[n]||0)/tot*100)+'%':'0%', height:'100%', background:bars[n], borderRadius:4, transition:'width 0.4s' }} />
            </div>
            <span style={{ fontSize:11, fontFamily:'monospace', color:'#5a7ec0', width:38, textAlign:'right' }}>
              {target?((atgc[n]||0)/tot*100).toFixed(1)+'%':'--'}
            </span>
          </div>
        ))}
      </Section>
      <Section title="ORF Finder">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:12, color:'#5a7ec0' }}>Min length (bp)</span>
          <input type="number" value={minORF} onChange={e=>setMinORF(parseInt(e.target.value)||100)} style={{ width:70 }} />
        </div>
        <button className="btn btn-primary" style={{ width:'100%', marginBottom:10 }} onClick={runORF} disabled={!target||running}>
          {running?'Running…':'Find ORFs'}
        </button>
        {orfs.length>0 && (
          <div style={{ maxHeight:200, overflowY:'auto' }}>
            {orfs.slice(0,60).map((orf,i) => (
              <div key={i} style={{ fontSize:12, padding:'3px 6px', borderBottom:'1px solid #eef3ff', fontFamily:'"JetBrains Mono",monospace' }}>
                <span style={{ color:orf.strand===1?'#1a56db':'#c0300e', fontWeight:700 }}>{orf.strand===1?'+':'−'} F{(orf.frame%3)+1}</span>
                <span style={{ color:'#5a7ec0' }}> {(orf.start+1).toLocaleString()}–{(orf.end+1).toLocaleString()}</span>
                <span style={{ color:'#1a4f9c' }}> {orf.length} bp</span>
              </div>
            ))}
            {orfs.length>60 && <div style={{ fontSize:12, color:'#93b4f0', padding:'4px 0', textAlign:'center' }}>…and {orfs.length-60} more</div>}
          </div>
        )}
      </Section>
      <Section title="Translation">
        {['+1','+2','+3'].map((label,frame) => {
          const sub     = (selectionText||seq).slice(frame, frame+300)
          const protein = sub ? translate(sub) : ''
          return (
            <div key={frame} style={{ marginBottom:8 }}>
              <div style={{ fontSize:11, color:'#5a7ec0', marginBottom:3, fontWeight:700 }}>Frame {label}</div>
              <div style={{ fontSize:12, fontFamily:'"JetBrains Mono",monospace', padding:'5px 8px', borderRadius:6, background:'#f0f5ff', border:'1px solid #c0d4f5', color:'#5a3a9c', wordBreak:'break-all', maxHeight:52, overflowY:'auto', lineHeight:1.5 }}>
                {protein.slice(0,120)}{protein.length>120?'…':''}
              </div>
            </div>
          )
        })}
      </Section>
    </>
  )
}
