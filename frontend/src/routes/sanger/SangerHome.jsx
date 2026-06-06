import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Microscope, FolderOpen } from 'lucide-react'
import { useDocStore } from '../../store/useDocStore'
import { parseAB1 } from '../../components/viewers/SangerViewer'
import { useStore } from '../../store/useStore'

export default function SangerHome() {
  const fileRef  = useRef()
  const navigate = useNavigate()
  const addDoc   = useDocStore(s => s.addDoc)

  const load = async (file) => {
    try {
      const buffer = await file.arrayBuffer()
      const data   = parseAB1(buffer)
      const id = addDoc('sanger', file.name, { files:[{ name:file.name, data }] })
      navigate(`/sanger/${id}`)
    } catch (e) {
      useStore.getState().notify('AB1 error: ' + e.message, 'error')
    }
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
      <Microscope size={40} color="#059669"/>
      <h2 style={{ fontSize:20, fontWeight:800, color:'#0f2460', margin:'12px 0 4px' }}>Sanger Trace</h2>
      <p style={{ fontSize:13, color:'#5a7ec0', marginBottom:20 }}>Upload an AB1 chromatogram file</p>
      <input ref={fileRef} type="file" accept=".ab1" style={{ display:'none' }}
        onChange={e => { const f=e.target.files[0]; if(f) load(f); e.target.value='' }}/>
      <button onClick={() => fileRef.current.click()}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10,
          border:'2px solid #05966944', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:700, color:'#059669' }}>
        <FolderOpen size={16}/> Open .ab1 file
      </button>
    </div>
  )
}
