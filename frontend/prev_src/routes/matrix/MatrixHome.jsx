import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid3x3, FolderOpen } from 'lucide-react'
import { useDocStore } from '../../store/useDocStore'
import { parseMatrix } from '../../components/viewers/MatrixViewer'
import { useStore } from '../../store/useStore'

// Shown at /matrix when no document is open (or via the + tab)
export default function MatrixHome() {
  const fileRef  = useRef()
  const navigate = useNavigate()
  const addDoc   = useDocStore(s => s.addDoc)

  const load = async (file) => {
    try {
      const data = parseMatrix(await file.text())
      const id = addDoc('matrix', file.name, data)
      navigate(`/matrix/${id}`)
    } catch (e) {
      useStore.getState().notify('Matrix error: ' + e.message, 'error')
    }
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
      <Grid3x3 size={40} color="#d97706"/>
      <h2 style={{ fontSize:20, fontWeight:800, color:'#0f2460', margin:'12px 0 4px' }}>Matrix / Heatmap</h2>
      <p style={{ fontSize:13, color:'#5a7ec0', marginBottom:20 }}>Upload a distance matrix or allelic profile (.tsv / .csv)</p>
      <input ref={fileRef} type="file" accept=".tsv,.csv,.txt,.tab" style={{ display:'none' }}
        onChange={e => { const f=e.target.files[0]; if(f) load(f); e.target.value='' }}/>
      <button onClick={() => fileRef.current.click()}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10,
          border:'2px solid #d9770644', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:700, color:'#d97706' }}>
        <FolderOpen size={16}/> Open matrix file
      </button>
    </div>
  )
}
