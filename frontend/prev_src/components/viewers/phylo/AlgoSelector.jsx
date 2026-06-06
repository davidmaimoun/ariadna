import { Network, GitBranch, FolderOpen } from 'lucide-react'

const ALGOS = [
  { id:'mst-kruskal', label:'MST — Kruskal',      icon:<Network size={22}/>,  color:'#1a56db', accepts:'.tsv,.csv,.txt,.tab', type:'graph', desc:'Minimum spanning tree. Classic, fast, robust.' },
  { id:'mst-prim',    label:'MST — Prim',          icon:<Network size={22}/>,  color:'#0e8c9e', accepts:'.tsv,.csv,.txt,.tab', type:'graph', desc:'Alternative MST. Identical result, different traversal.' },
  { id:'goeburst',    label:'GoeBURST',             icon:<Network size={22}/>,  color:'#6b40a8', accepts:'.tsv,.csv,.txt,.tab', type:'graph', desc:'Prioritises founders by SLV count. Ideal for MLST/cgMLST.' },
  { id:'nj',          label:'Neighbor-Joining',     icon:<GitBranch size={22}/>,color:'#0a6e40', accepts:'.tsv,.csv,.txt,.tab', type:'tree',  desc:'Classic phylogenetic tree. Good for evolutionary inference.' },
  { id:'upgma',       label:'UPGMA',                icon:<GitBranch size={22}/>,color:'#cc7000', accepts:'.tsv,.csv,.txt,.tab', type:'tree',  desc:'Ultrametric tree assuming constant evolution rate.' },
  { id:'nwk',         label:'Load Newick (.nwk)',   icon:<GitBranch size={22}/>,color:'#c0300e', accepts:'.nwk,.tre,.tree,.nex', type:'newick',desc:'Import a pre-computed tree in Newick format.' },
]


export default function AlgoSelector({ onSelect, loading, loadingMsg, loadingPct }) {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f7ff', overflow:'auto' }}>
      <div style={{ maxWidth:700, width:'100%', padding:40 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <GitBranch size={44} color="#1a56db" style={{ marginBottom:10 }}/>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#0f2460', margin:'0 0 6px', fontFamily:'"IBM Plex Sans",sans-serif' }}>
            Phylogenetic Tree Viewer
          </h2>
          <p style={{ fontSize:13.5, color:'#5a7ec0', margin:0 }}>
            Choose an algorithm, then upload your data file
          </p>
        </div>

        {loading && (
          <div style={{ marginBottom:24, padding:'12px 16px', background:'#dce8fb', borderRadius:10, border:'1px solid #93b4f0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              {[0,1,2].map(i=><div key={i} className="loading-dot" style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent)' }}/>)}
              <span style={{ fontSize:13, color:'#1a3faa', fontWeight:600 }}>{loadingMsg}</span>
            </div>
            <div style={{ height:5, background:'#93b4f0', borderRadius:3, overflow:'hidden' }}>
              <div style={{ width:loadingPct+'%', height:'100%', background:'linear-gradient(90deg,#1a56db,#4a82e4)', transition:'width .2s', borderRadius:3 }}/>
            </div>
            <span style={{ fontSize:11, color:'#5a7ec0' }}>{loadingPct}%</span>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
          {ALGOS.map(algo => {
            const fileRef = React.createRef()
            return (
              <div key={algo.id}>
                <input type="file" ref={fileRef} accept={algo.accepts} style={{ display:'none' }}
                  onChange={e => { const f=e.target.files[0]; if(f) onSelect(algo.id, f, algo.type); e.target.value='' }}/>
                <button onClick={() => fileRef.current.click()} style={{
                  width:'100%', padding:'18px 14px', borderRadius:12, textAlign:'center',
                  border:`2px solid #c0d4f5`, background:'#fff', cursor:'pointer',
                  transition:'all .15s', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=algo.color; e.currentTarget.style.boxShadow=`0 4px 16px ${algo.color}22` }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor='#c0d4f5'; e.currentTarget.style.boxShadow='none' }}
                >
                  <span style={{ color:algo.color }}>{algo.icon}</span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:'#0f2460', lineHeight:1.2 }}>{algo.label}</span>
                  <span style={{ fontSize:10.5, color:'#5a7ec0', lineHeight:1.4 }}>{algo.desc}</span>
                  <span style={{ fontSize:10, color:'#93b4f0', fontFamily:'"JetBrains Mono",monospace' }}>{algo.accepts}</span>
                </button>
              </div>
            )
          })}
        </div>
        <p style={{ textAlign:'center', fontSize:11.5, color:'#93b4f0', marginTop:20 }}>
          💡 Supports chewBBACA allelic profiles — Hamming distances computed automatically
        </p>
      </div>
    </div>
  )
}

// Need React for createRef
import React from 'react'
import { parseNewick, parseDistanceMatrix, buildMST } from '../../../utils/phyloUtils'

// ─────────────────────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
//  DRAWING OVERLAY — SVG layer on top of any tree canvas
//  Drag to draw ellipse or rectangle, click existing to select/edit/delete
// ─────────────────────────────────────────────────────────────────────────────
const DRAW_COLORS = ['#1a56db','#c0300e','#0a6e40','#cc7000','#6b40a8','#0e8c9e','#e05080']
