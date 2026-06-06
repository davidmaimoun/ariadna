import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn, ZoomBtns, StatBadge } from './ToolbarFeatures'

export default function MSAToolbar({ onClose, cellW, setCellW, colStart, setColStart, alnLen, visibleCols, seqType, hoverCol, conservation=[], consensus=[] }) {
  return (
    <CommonToolbar type="msa" onClose={onClose}>
      {seqType && <StatBadge>{seqType.toUpperCase()}</StatBadge>}
      <Sep/>
      <span style={{ fontSize:11, color:'var(--txt3)', fontWeight:600, flexShrink:0 }}>Zoom</span>
      {[6,10,14,20].map(w => (
        <ToolbarBtn key={w} onClick={()=>setCellW(w)} active={cellW===w} color="#1a56db">{w}px</ToolbarBtn>
      ))}
      <ZoomBtns onOut={()=>setCellW(w=>Math.max(4,w-2))} onIn={()=>setCellW(w=>Math.min(28,w+2))}/>
      <Sep/>
      <ToolbarBtn onClick={()=>setColStart(0)} style={{padding:'4px 8px'}} title="First">|◀</ToolbarBtn>
      <ToolbarBtn onClick={()=>setColStart(s=>Math.max(0,s-visibleCols))} style={{padding:'4px 8px'}}>◀</ToolbarBtn>
      <StatBadge>{colStart+1}–{Math.min(colStart+visibleCols,alnLen)} / {alnLen}</StatBadge>
      <ToolbarBtn onClick={()=>setColStart(s=>Math.min(alnLen-visibleCols,s+visibleCols))} style={{padding:'4px 8px'}}>▶</ToolbarBtn>
      <ToolbarBtn onClick={()=>setColStart(Math.max(0,alnLen-visibleCols))} style={{padding:'4px 8px'}} title="Last">▶|</ToolbarBtn>
      {hoverCol!=null && <><Sep/><StatBadge>Col {hoverCol+1} · {((conservation[hoverCol]||0)*100).toFixed(0)}% · {consensus[hoverCol]||'-'}</StatBadge></>}
    </CommonToolbar>
  )
}
