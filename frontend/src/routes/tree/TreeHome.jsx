import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, FolderOpen } from 'lucide-react'
import { useDocStore } from '../../store/useDocStore'

const ALGOS = [
  { id:'mst-kruskal', label:'MST — Kruskal', color:'#1a56db', desc:'Minimum spanning tree. Classic, fast, robust.' },
  { id:'mst-prim',    label:'MST — Prim',    color:'#0e8c9e', desc:'Alternative MST. Identical result, different traversal.' },
  { id:'goeburst',    label:'GoeBURST',      color:'#6b40a8', desc:'Prioritises founders by SLV count. Ideal for MLST/cgMLST.' },
  { id:'nj',          label:'Neighbor-Joining', color:'#0a6e40', desc:'Classic phylogenetic tree. Good for evolutionary inference.' },
  { id:'upgma',       label:'UPGMA',         color:'#cc7000', desc:'Ultrametric tree assuming constant evolution rate.' },
  { id:'nwk',         label:'Load Newick',   color:'#7c3aed', desc:'Import a pre-computed tree (IQ-TREE, FastTree, RAxML…).' },
]

export default function TreeHome() {
  const navigate = useNavigate()
  const addDoc   = useDocStore(s => s.addDoc)
  const refs     = useRef({})

  const pick = async (algo, file) => {
    // Store the file TEXT (serializable) + algo; PhyloTree computes on mount
    const text = await file.text()
    const id = addDoc('tree', file.name, { algoId: algo, text, fileName: file.name })
    navigate(`/tree/${id}`)
  }

  return (
    <div style={{ height:'100%', overflow:'auto', padding:'32px 24px', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
        <GitBranch size={22} color="#7c3aed"/>
        <h2 style={{ fontSize:20, fontWeight:800, color:'#0f2460' }}>Phylogenetic Tree</h2>
      </div>
      <p style={{ fontSize:13, color:'#5a7ec0', marginBottom:24 }}>
        Pick an algorithm + distance matrix (.tsv/.csv) — or load a Newick file
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:740, width:'100%' }}>
        {ALGOS.map(a => {
          const isNwk = a.id === 'nwk'
          const accepts = isNwk ? '.nwk,.tre,.tree,.nex,.nexus' : '.tsv,.csv,.txt,.tab'
          return (
            <div key={a.id} style={{ gridColumn: isNwk ? '1 / -1' : undefined }}>
              <input ref={el => refs.current[a.id]=el} type="file" accept={accepts} style={{ display:'none' }}
                onChange={e => { const f=e.target.files[0]; if(f) pick(a.id, f); e.target.value='' }}/>
              <button onClick={() => refs.current[a.id]?.click()}
                style={{ width:'100%', padding:'14px 14px', borderRadius:10, textAlign:'left', cursor:'pointer',
                  border:`2px solid ${a.color}22`, background:'#fff', transition:'all .15s',
                  display:'flex', flexDirection:isNwk?'row':'column', alignItems:isNwk?'center':'flex-start', gap:isNwk?14:6 }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=a.color; e.currentTarget.style.transform='translateY(-1px)' }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${a.color}22`; e.currentTarget.style.transform='none' }}>
                {isNwk && <GitBranch size={26} color={a.color}/>}
                <div>
                  <div style={{ fontSize:14.5, fontWeight:700, color:'#0f2460', marginBottom:4 }}>{a.label}</div>
                  <div style={{ fontSize:12.5, color:'#5a7ec0', lineHeight:1.45 }}>{a.desc}</div>
                  <div style={{ fontSize:11.5, color:a.color, fontWeight:600, marginTop:5 }}>
                    <FolderOpen size={10} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }}/>
                    {isNwk ? '.nwk .tre .tree .nex' : '.tsv .csv .txt .tab'}
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}