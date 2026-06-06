import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn, StatBadge } from './ToolbarFeatures'

export default function BLASTToolbar({ onClose, hitCount=0, queryId, evalThreshold, setEvalThreshold }) {
  return (
    <CommonToolbar type="blast" onClose={onClose}>
      {queryId && <StatBadge>{queryId}</StatBadge>}
      <StatBadge>{hitCount.toLocaleString()} hits</StatBadge>
      <Sep/>
      <span style={{fontSize:11,color:'var(--txt4)',flexShrink:0}}>E-value ≤</span>
      {[1e-10,1e-5,1e-2,1].map(v=>(
        <ToolbarBtn key={v} onClick={()=>setEvalThreshold?.(v)} active={evalThreshold===v} color="#1a56db">{v}</ToolbarBtn>
      ))}
    </CommonToolbar>
  )
}
