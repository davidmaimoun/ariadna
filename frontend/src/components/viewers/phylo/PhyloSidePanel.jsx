import { useState, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { Sliders, Info, Circle, GitBranch, Upload, X, ChevronDown, ChevronUp } from 'lucide-react'
import { collectLeaves, treeStats, parseMetadata } from '../../../utils/treeHelpers'
import AnnotSidePanel from './AnnotSidePanel'

export default function PhyloSidePanel({ treeData, opts, setOpts, meta, setMeta, highlight, setHighlight, annotGroups, setAnnotGroups, drawMode, setDrawMode, drawShape, setDrawShape, drawColor, setDrawColor, drawOpacity, setDrawOpacity, showLegend, setShowLegend }) {
  const [tab, setTab] = useState('display')
  const metaRef = useRef()


  // All hooks before any early return — Rules of Hooks
  const { tree, graph, filename, algo } = treeData || {}
  const stats      = useMemo(() => tree ? treeStats(tree) : null, [tree])
  const metaFields = meta ? Object.keys(Object.values(meta)[0] || {}) : []
  const nNodes     = tree ? collectLeaves(tree).length : graph?.nodes.length

  // Don't return early — always show Display + Groups tabs
  // treeData may be null while tree is still loading

  const handleMeta = async (e) => {
    const file=e.target.files[0]; if(!file) return
    setMeta(parseMetadata(await file.text())); e.target.value=''
  }

  const Slider = ({label,field,min,max,step=1}) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:12, color:'var(--txt2)' }}>{label}</span>
        <span style={{ fontSize:12, fontFamily:'monospace', color:'var(--accent)' }}>{opts[field]}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={opts[field]}
        onChange={e=>setOpts(o=>({...o,[field]:parseFloat(e.target.value)}))}
        style={{ width:'100%', accentColor:'var(--accent)' }}/>
    </div>
  )

  const nodeColors = ['#1a56db','#0e8c9e','#6b40a8','#c0300e','#0a6e40','#cc7000','#333333']
  const lineColors = ['#b8cfef','#aaaaaa','#1a56db','#0a6e40','#333333','#c0300e']

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', borderBottom:'1.5px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        {[['display',<Sliders size={12}/>,'Display'],['annots',<Circle size={12}/>,'Groups'],['info',<Info size={12}/>,'Info']].map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1, padding:'8px 4px', fontSize:12, fontWeight:600,
            color:tab===id?'var(--accent)':'var(--txt3)',
            background:tab===id?'#fff':'transparent',
            border:'none', borderBottom:`2px solid ${tab===id?'var(--accent)':'transparent'}`,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
          }}>{icon} {label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14 }}>
        {tab==='display' && (
          <>
            {/* Legend toggle — top of Display tab */}
            <div style={{ marginBottom:14, padding:'10px 12px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border2)' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12.5, color:'var(--txt2)', fontWeight:600 }}>
                <input type="checkbox"
                  checked={!!showLegend}
                  onChange={e=>setShowLegend?.(e.target.checked)}
                  style={{ accentColor:'var(--accent)', width:15, height:15 }}/>
                Show color legend on tree
              </label>
              {!showLegend && (
                <div style={{ fontSize:11, color:'var(--txt4)', marginTop:5, paddingLeft:23 }}>
                  Load metadata and select a field to display a draggable legend
                </div>
              )}
            </div>

            <Slider label="Node size"       field="nodeSize" min={1}  max={60} step={0.5}/>
            <Slider label="Label font size" field="fontSize" min={6}  max={40} step={0.5}/>
            <Slider label="Branch label size" field="branchFontSize" min={0} max={16} step={0.5}/>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:6 }}>Node color</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {nodeColors.map(c=>(
                  <button key={c} onClick={()=>setOpts(o=>({...o,leafColor:c}))} style={{
                    width:26, height:26, borderRadius:'50%', background:c, cursor:'pointer',
                    border:opts.leafColor===c?'3px solid #ffe000':'2px solid #fff',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
                  }}/>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:6 }}>Branch color</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {lineColors.map(c=>(
                  <button key={c} onClick={()=>setOpts(o=>({...o,lineColor:c}))} style={{
                    width:30, height:8, borderRadius:4, background:c, cursor:'pointer',
                    border:opts.lineColor===c?'2px solid #ffe000':'1px solid #ccc',
                  }}/>
                ))}
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border2)', paddingTop:14, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--txt2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Metadata</div>
              <input ref={metaRef} type="file" accept=".tsv,.csv,.txt" style={{ display:'none' }} onChange={handleMeta}/>
              <button className="btn" style={{ width:'100%', marginBottom:8, justifyContent:'center', fontSize:12 }}
                onClick={()=>metaRef.current.click()}>
                <Upload size={13}/> Load metadata (CSV/TSV)
              </button>
              <div style={{ fontSize:10.5, color:'var(--txt4)', marginBottom:8 }}>First col = sample name, rest = fields</div>
              {metaFields.length>0&&(
                <>
                  <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:5 }}>Color nodes by field</div>
                  <select value={opts.metaField||''} onChange={e=>setOpts(o=>({...o,metaField:e.target.value||null}))}
                    style={{ width:'100%', fontSize:12, marginBottom:8 }}>
                    <option value="">None</option>
                    {metaFields.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:5 }}>Rename nodes from field</div>
                  <select value={opts.nodeLabelField||''} onChange={e=>setOpts(o=>({...o,nodeLabelField:e.target.value||null}))}
                    style={{ width:'100%', fontSize:12 }}>
                    <option value="">— Original names —</option>
                    {metaFields.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize:10, color:'var(--txt4)', marginTop:4 }}>Works in MST/Force mode</div>
                  {opts.metaField&&(
                    <div style={{ marginTop:8 }}>
                      {[...new Set(Object.values(meta).map(m=>m[opts.metaField]).filter(Boolean))].map((v,i)=>(
                        <div key={v} style={{ display:'flex', alignItems:'center', gap:7, padding:'2px 0', fontSize:11 }}>
                          <div style={{ width:12, height:12, borderRadius:3, background:d3.schemeTableau10[i%10], flexShrink:0 }}/>
                          <span style={{ color:'var(--txt2)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ borderTop:'1px solid var(--border2)', paddingTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--txt2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Highlight</div>
              <input type="text" placeholder="Sample name…" value={highlight||''}
                onChange={e=>setHighlight(e.target.value||null)}
                style={{ width:'100%', fontSize:12 }}/>
              {highlight&&(
                <button className="btn btn-ghost" style={{ width:'100%', marginTop:6, fontSize:12 }}
                  onClick={()=>setHighlight(null)}>
                  <X size={12}/> Clear
                </button>
              )}
            </div>
          </>
        )}

        {tab==='annots' && (
          <>
            <AnnotSidePanel
              annotGroups={annotGroups} setAnnotGroups={setAnnotGroups}
              drawMode={drawMode} setDrawMode={setDrawMode}
              drawShape={drawShape} setDrawShape={setDrawShape}
              activeColor={drawColor} setActiveColor={setDrawColor}
              opacity={drawOpacity} setOpacity={setDrawOpacity}
            />
          </>
        )}
        {tab==='info'&&(
          <>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Tree info</div>
            {[
              ['File', filename||'—'],
              ['Algorithm', algo||'—'],
              ['Type', tree?'Newick tree':'Force graph'],
              ['Leaves / Nodes', nNodes],
              ...(stats?[['Max depth',stats.maxDepth],['Min depth',stats.minDepth]]:[]),
              ...(graph?[['Edges', graph.edges.length]]:[]),
            ].map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid var(--border2)', fontSize:12 }}>
                <span style={{ color:'var(--txt3)' }}>{l}</span>
                <span style={{ fontWeight:600, color:'var(--txt)' }}>{v}</span>
              </div>
            ))}
            {meta&&(
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginTop:16, marginBottom:8 }}>
                  Metadata — {Object.keys(meta).length} samples
                </div>
                {metaFields.map(f=>(
                  <div key={f} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--border2)', fontSize:12 }}>
                    <span style={{ color:'var(--txt3)' }}>{f}</span>
                    <span style={{ color:'var(--txt4)' }}>{[...new Set(Object.values(meta).map(m=>m[f]).filter(Boolean))].length} values</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

