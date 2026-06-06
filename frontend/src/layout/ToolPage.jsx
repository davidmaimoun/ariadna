// Wraps a self-contained viewer. The tab bar is now global (AppShell).
export default function ToolPage({ children }) {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {children}
    </div>
  )
}
