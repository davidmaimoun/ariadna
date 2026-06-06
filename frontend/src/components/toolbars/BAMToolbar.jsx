import CommonToolbar from './CommonToolbar'
import { Sep, ToolbarSelect, StatBadge } from './ToolbarFeatures'

export default function BAMToolbar({ onClose, readCount=0, chroms=[], chrom, setChrom, sq={} }) {
  return (
    <CommonToolbar type="bam" label="SAM / BAM" onClose={onClose}>
      <StatBadge>{readCount.toLocaleString()} reads</StatBadge>
      {chroms.length>0 && (
        <><Sep/><ToolbarSelect label="Chr" value={chrom||''} onChange={v=>setChrom?.(v)}
          options={chroms.map(c=>({value:c,label:c+' ('+(sq[c]||0).toLocaleString()+' bp)'}))}/></>
      )}
    </CommonToolbar>
  )
}
