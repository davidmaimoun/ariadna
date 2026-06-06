import { ZoomIn, ZoomOut, Download } from 'lucide-react'
import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn, SearchBox, StatBadge } from './ToolbarFeatures'

export default function MatrixToolbar({
  onClose, viewMode, setViewMode,
  colorscale, setColorscale, COLORSCALES={},
  sortMode, setSortMode, search, setSearch,
  cellSize, setCellSize, autoCell,
  tableFontSize, setTableFontSize,
  paThreshold, setPaThreshold,
  filteredRows=[], filteredCols=[], minVal=0, maxVal=1,
  onExportPNG,
}) {
  const cell    = cellSize || autoCell || 18
  const isTable = viewMode === 'table'

  return (
    <CommonToolbar type="matrix" onClose={onClose}>
      {/* View mode */}
      {[['table','Table'],['heatmap','Heatmap'],['pa','Presence/Absence']].map(([id,lbl]) => (
        <ToolbarBtn key={id} onClick={()=>setViewMode(id)} active={viewMode===id} color="#d97706">{lbl}</ToolbarBtn>
      ))}

      {/* P/A threshold */}
      {viewMode==='pa' && (
        <><Sep/><span style={{fontSize:11,color:'var(--txt4)',flexShrink:0}}>Threshold {'>'}</span>
        <input type="number" value={paThreshold} step="any" onChange={e=>setPaThreshold(parseFloat(e.target.value)||0)}
          style={{width:60,fontSize:12,height:28,borderRadius:6,border:'1.5px solid var(--border)',padding:'0 6px'}}/></>
      )}

      {/* Colorscale (heatmap only) */}
      {viewMode==='heatmap' && Object.keys(COLORSCALES).length>0 && (
        <><Sep/>{Object.keys(COLORSCALES).map(cs=>(
          <button key={cs} onClick={()=>setColorscale(cs)} title={cs} style={{
            width:28,height:16,borderRadius:4,cursor:'pointer',flexShrink:0,
            border:colorscale===cs?'2px solid #ffe000':'1px solid #ccc',
            background:`linear-gradient(to right,${COLORSCALES[cs](0)},${COLORSCALES[cs](.5)},${COLORSCALES[cs](1)})`,
          }}/>
        ))}</>
      )}

      {/* Sort */}
      <Sep/>
      {[['original','Original'],['sum','By sum'],['alpha','A→Z']].map(([id,lbl]) => (
        <ToolbarBtn key={id} onClick={()=>setSortMode(id)} active={sortMode===id} color="#d97706">{lbl}</ToolbarBtn>
      ))}

      {/* Search — TABLE ONLY (filters rows, keeps whole row) */}
      {isTable && (
        <><Sep/><SearchBox value={search} onChange={setSearch} placeholder="Filter rows…" width={130}/></>
      )}

      {/* Zoom — table zooms font, heatmap/pa zoom cell size */}
      <Sep/>
      {isTable ? (
        <>
          <ToolbarBtn onClick={()=>setTableFontSize(s=>Math.max(7,s-1))} style={{padding:'4px 8px'}}><ZoomOut size={13}/></ToolbarBtn>
          <StatBadge>{tableFontSize}px</StatBadge>
          <ToolbarBtn onClick={()=>setTableFontSize(s=>Math.min(22,s+1))} style={{padding:'4px 8px'}}><ZoomIn size={13}/></ToolbarBtn>
        </>
      ) : (
        <>
          <ToolbarBtn onClick={()=>setCellSize(s=>Math.max(2,(s||autoCell)-2))} style={{padding:'4px 8px'}}><ZoomOut size={13}/></ToolbarBtn>
          <StatBadge>{cell}px</StatBadge>
          <ToolbarBtn onClick={()=>setCellSize(s=>Math.min(64,(s||autoCell)+2))} style={{padding:'4px 8px'}}><ZoomIn size={13}/></ToolbarBtn>
          <ToolbarBtn onClick={()=>setCellSize(null)}>Auto</ToolbarBtn>
        </>
      )}

      {/* PNG export — heatmap & presence/absence (visual) */}
      {onExportPNG && (
        <><Sep/><ToolbarBtn onClick={onExportPNG} title="Export as PNG"><Download size={12}/> PNG</ToolbarBtn></>
      )}

      <Sep/>
      <StatBadge>{filteredRows.length}×{filteredCols.length}</StatBadge>
    </CommonToolbar>
  )
}