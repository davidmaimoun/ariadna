import { Download, ZoomIn, ZoomOut } from 'lucide-react'
import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn, StatBadge } from './ToolbarFeatures'

// Phylogenetic Tree | [algo badge] | [rect/circular/force] | [zoom] | [PNG] | [✏ Draw] | close
export default function PhyloToolbar({
  onClose,
  mode, setMode,
  hasTree, hasGraph,
  drawMode, setDrawMode,
  onExportPNG,
  algoLabel,
  isAllelic,
  zoom, setZoom,
}) {
  const hasData = hasTree || hasGraph

  return (
    <CommonToolbar type="tree" onClose={onClose}>
      {hasData && <>
        {/* Algo badge */}
        {algoLabel && (
          <span style={{
            fontSize:11, fontFamily:'monospace', fontWeight:700,
            color:'#7c3aed', background:'#f5f3ff',
            padding:'3px 10px', borderRadius:20,
            border:'1.5px solid #c4b5fd', flexShrink:0,
          }}>
            {algoLabel}
          </span>
        )}
        {isAllelic && (
          <span style={{
            fontSize:11, color:'#6b7280', background:'var(--bg2)',
            padding:'3px 10px', borderRadius:20,
            border:'1px solid var(--border)', flexShrink:0,
          }}>
            chewBBACA · Hamming
          </span>
        )}

        <Sep/>

        {/* View mode buttons */}
        {hasTree && (
          <div style={{ display:'flex', gap:4 }}>
            {[['rect','Rectangular'],['circular','Circular']].map(([id, lbl]) => (
              <ToolbarBtn key={id} onClick={() => setMode(id)} active={mode===id} color="#7c3aed">
                {lbl}
              </ToolbarBtn>
            ))}
          </div>
        )}
        {hasGraph && (
          <ToolbarBtn onClick={() => setMode('force')} active={mode==='force'} color="#7c3aed">
            Force graph
          </ToolbarBtn>
        )}

        <Sep/>

        {/* Zoom — scales the tree canvas (rect & circular) */}
        {hasTree && mode !== 'force' && setZoom && (
          <>
            <ToolbarBtn onClick={() => setZoom(z => Math.max(0.4, +(z-0.2).toFixed(2)))} title="Zoom out"><ZoomOut size={13}/></ToolbarBtn>
            <StatBadge>{Math.round((zoom||1)*100)}%</StatBadge>
            <ToolbarBtn onClick={() => setZoom(z => Math.min(4, +(z+0.2).toFixed(2)))} title="Zoom in"><ZoomIn size={13}/></ToolbarBtn>
            <ToolbarBtn onClick={() => setZoom(1)} title="Reset zoom">Reset</ToolbarBtn>
            <Sep/>
          </>
        )}

        {/* PNG export */}
        <ToolbarBtn onClick={onExportPNG} title="Export as PNG">
          <Download size={12}/> PNG
        </ToolbarBtn>

        <Sep/>

        {/* Draw mode */}
        <button onClick={() => setDrawMode(m => !m)} style={{
          display:'flex', alignItems:'center', gap:5,
          padding:'4px 12px', borderRadius:7, flexShrink:0,
          border:`1.5px solid ${drawMode ? '#7c3aed' : 'var(--border)'}`,
          background: drawMode ? '#7c3aed' : 'transparent',
          color: drawMode ? '#fff' : 'var(--txt2)',
          fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s',
        }}>
          ✏ {drawMode ? 'Drawing…' : 'Draw'}
        </button>
      </>}
    </CommonToolbar>
  )
}