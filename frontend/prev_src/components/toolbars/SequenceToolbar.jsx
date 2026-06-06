import { useRef, useState } from 'react'
import { Plus, Undo2, Redo2, Copy, Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { parseAnnotationFile, exportFASTA, exportGFF3 } from '../../utils/bioUtils'
import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn, ZoomBtns, SearchBox, StatBadge } from './ToolbarFeatures'

const fmtSpan = n => n >= 1e6 ? (n/1e6).toFixed(1)+' Mbp' : n >= 1e3 ? (n/1e3).toFixed(1)+' Kbp' : n+' bp'
const dl = (content, name, type) => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click() }

export default function SequenceToolbar({ onClose }) {
  const annotRef = useRef()
  const [copied, setCopied] = useState(false)

  const { sequenceMeta, sequence, editedSequence, annotations, selectionText,
    viewStart, viewEnd, setViewport, zoomTo, jumpTo, addAnnotations, notify,
    searchQuery, searchResults, searchIndex, setSearch, setSearchResults,
    undo, redo, history, historyIndex } = useStore()

  const seq  = editedSequence || sequence || ''
  const span = Math.max(1, viewEnd - viewStart)

  const handleSearch = q => {
    setSearch(q)
    if (!q || q.length < 2) { setSearchResults([]); return }
    const results=[], upper=seq.toUpperCase(), pat=q.toUpperCase()
    let idx=0; while(idx<upper.length){ const f=upper.indexOf(pat,idx); if(f===-1) break; results.push(f); idx=f+1 }
    setSearchResults(results)
    if (results.length) jumpTo(results[0])
    notify(`${results.length} match${results.length!==1?'es':''} found`)
  }
  const navSearch = dir => {
    if (!searchResults.length) return
    const ni = dir==='next' ? (searchIndex+1)%searchResults.length : (searchIndex-1+searchResults.length)%searchResults.length
    useStore.setState({ searchIndex:ni }); jumpTo(searchResults[ni])
  }
  const doCopy = () => { navigator.clipboard.writeText(selectionText); notify('Copied','success'); setCopied(true); setTimeout(()=>setCopied(false),1800) }

  return (
    <CommonToolbar type="sequence" onClose={onClose}>
      {/* Annotation */}
      <input ref={annotRef} type="file" accept=".gff,.gff3,.gtf,.bed" style={{display:'none'}}
        onChange={async e => { const f=e.target.files[0]; if(!f) return; const ft=parseAnnotationFile(await f.text(),f.name); addAnnotations(ft,f.name); notify(`${ft.length} features`,'success'); e.target.value='' }}/>
      <ToolbarBtn onClick={() => annotRef.current.click()} title="Load annotation file">
        <Plus size={12}/> Annotation
      </ToolbarBtn>

      <Sep/>

      {/* Undo/Redo */}
      <ToolbarBtn onClick={undo} disabled={historyIndex<0}        title="Undo"><Undo2 size={13}/></ToolbarBtn>
      <ToolbarBtn onClick={redo} disabled={historyIndex>=history.length-1} title="Redo"><Redo2 size={13}/></ToolbarBtn>

      <Sep/>

      {/* Search */}
      <SearchBox value={searchQuery} onChange={handleSearch}
        onNext={() => navSearch('next')} onPrev={() => navSearch('prev')}
        resultCount={searchResults.length} resultIndex={searchIndex}
        placeholder="Search motif…" width={140}/>

      <Sep/>

      {/* Zoom */}
      <ZoomBtns onIn={() => zoomTo(null,.5)} onOut={() => zoomTo(null,2)}
        onReset={() => setViewport(0, sequenceMeta?.length||seq.length||1000)} resetLabel="All"/>
      <ToolbarBtn onClick={() => { const c=Math.round((viewStart+viewEnd)/2); setViewport(c-50,c+50) }} title="1 bp/px">1:1</ToolbarBtn>

      {/* Selection */}
      {selectionText && (
        <>
          <Sep/>
          <StatBadge>{selectionText.length.toLocaleString()} bp</StatBadge>
          <button onClick={doCopy} style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'4px 12px', borderRadius:7, flexShrink:0,
            border:`1.5px solid ${copied?'#059669':'var(--border)'}`,
            background:copied?'#ecfdf5':'transparent',
            color:copied?'#059669':'var(--txt2)',
            fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .2s',
          }}><Copy size={12}/>{copied?'Copied!':'Copy'}</button>
        </>
      )}

      {/* Exports */}
      {sequenceMeta && (
        <>
          <Sep/>
          <ToolbarBtn onClick={() => { dl(exportFASTA(sequenceMeta,editedSequence||sequence),(sequenceMeta.id||'seq')+'.fasta','text/plain'); notify('FASTA exported','success') }}>
            <Download size={12}/> FASTA
          </ToolbarBtn>
          {annotations.length>0 && (
            <ToolbarBtn onClick={() => dl(exportGFF3(annotations,sequenceMeta.id),(sequenceMeta.id||'seq')+'.gff3','text/plain')}>
              <Download size={12}/> GFF3
            </ToolbarBtn>
          )}
        </>
      )}

      <Sep/>
      <StatBadge>{viewStart.toLocaleString()}–{viewEnd.toLocaleString()} ({fmtSpan(span)})</StatBadge>
    </CommonToolbar>
  )
}
