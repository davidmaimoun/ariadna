import TabBar from './TabBar'

// Wraps a self-contained viewer with the tool's tab bar.
// The viewer itself renders toolbar | content | sidebar.
export default function ToolPage({ tool, color, activeId, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <TabBar tool={tool} color={color} activeId={activeId}/>
      <div style={{ flex:1, overflow:'hidden', minHeight:0, position:'relative' }}>
        {children}
      </div>
    </div>
  )
}
