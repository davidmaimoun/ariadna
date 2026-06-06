import CommonSidebar from './CommonSidebar'
import PhyloSidePanel from '../viewers/phylo/PhyloSidePanel'

// Wraps PhyloSidePanel (Display/Groups/Info tabs) in CommonSidebar
export default function PhyloSidebar({ treeData, opts, setOpts, meta, setMeta, highlight, setHighlight, annotGroups, setAnnotGroups, drawMode, setDrawMode, drawShape, setDrawShape, drawColor, setDrawColor, drawOpacity, setDrawOpacity, showLegend, setShowLegend, width = 300 }) {
  return (
    <CommonSidebar color="#7c3aed" width={width} sections={[
      { id:'phylo', label:'Options', content:
        <PhyloSidePanel treeData={treeData} opts={opts} setOpts={setOpts} meta={meta} setMeta={setMeta} highlight={highlight} setHighlight={setHighlight} annotGroups={annotGroups} setAnnotGroups={setAnnotGroups} drawMode={drawMode} setDrawMode={setDrawMode} drawShape={drawShape} setDrawShape={setDrawShape} drawColor={drawColor} setDrawColor={setDrawColor} drawOpacity={drawOpacity} setDrawOpacity={setDrawOpacity} showLegend={showLegend} setShowLegend={setShowLegend}/>
      }
    ]}/>
  )
}
