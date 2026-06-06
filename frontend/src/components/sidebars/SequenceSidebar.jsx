import CommonSidebar from './CommonSidebar'
import SidePanel from '../viewers/SidePanel'

// Wraps the existing SidePanel in CommonSidebar for sequence viewer
export default function SequenceSidebar({ width = 290 }) {
  return (
    <CommonSidebar
      color="#1a56db"
      width={width}
      sections={[
        { id:'features', label:'Features', content: <SidePanel width={width}/> }
      ]}
    />
  )
}
