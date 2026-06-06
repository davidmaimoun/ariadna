import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarBtn, SearchBox, StatBadge, ToolbarSelect } from './ToolbarFeatures'

export default function VCFToolbar({ onClose, variantCount=0, samples=[], filterSample, setFilterSample, filterType, setFilterType, search, setSearch }) {
  return (
    <CommonToolbar type="vcf" onClose={onClose}>
      <StatBadge>{variantCount.toLocaleString()} variants</StatBadge>
      {samples.length>1 && (
        <><Sep/><ToolbarSelect label="Sample" value={filterSample||''} onChange={v=>setFilterSample?.(v||null)}
          options={[{value:'',label:'All'},...samples.map(s=>({value:s,label:s}))]}/></>
      )}
      <Sep/>
      {['SNP','INDEL','SV','All'].map(t=>(
        <ToolbarBtn key={t} onClick={()=>setFilterType?.(t==='All'?null:t)} active={filterType===t||(t==='All'&&!filterType)} color="#1a56db">{t}</ToolbarBtn>
      ))}
      <Sep/>
      <SearchBox value={search||''} onChange={v=>setSearch?.(v)} placeholder="Search…" width={120}/>
    </CommonToolbar>
  )
}
