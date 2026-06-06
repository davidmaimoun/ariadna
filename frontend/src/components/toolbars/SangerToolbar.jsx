import { Download } from 'lucide-react'
import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn } from './ToolbarFeatures'

export default function SangerToolbar({ onClose, files=[], active, onSelectFile, onExportFASTA, onSaveAB1, saveEnabled, editedBases }) {
  return (
    <CommonToolbar type="sanger" onClose={onClose} onSave={saveEnabled?onSaveAB1:undefined} saveEnabled={saveEnabled} saveLabel="Save AB1">
      {files.map((f,i) => (
        <button key={i} onClick={()=>onSelectFile(i)} style={{
          padding:'3px 10px', borderRadius:6, cursor:'pointer', flexShrink:0,
          border:`1.5px solid ${active===i?'#059669':'var(--border)'}`,
          background:active===i?'#059669':'transparent',
          color:active===i?'#fff':'var(--txt3)',
          fontSize:11.5, fontFamily:'monospace', fontWeight:active===i?700:400, transition:'all .15s',
        }}>{f.name.replace(/\.ab1$/i,'')}</button>
      ))}
      {editedBases && <><Sep/><span style={{fontSize:11,color:'#d97706',fontWeight:600,flexShrink:0}}>✎ edited</span></>}
      <Sep/>
      <ToolbarBtn onClick={onExportFASTA} title="Export as FASTA"><Download size={12}/> FASTA</ToolbarBtn>
    </CommonToolbar>
  )
}
