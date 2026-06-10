import { Component } from 'react'

// Catches render/runtime errors in the subtree and shows a friendly recovery card
// instead of a blank white screen. Encourages reporting with a prefilled email.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep a console trace for debugging; no external logging.
    console.error('AriaDNA caught an error:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const subject = encodeURIComponent('AriaDNA bug report')
    const body = encodeURIComponent(
      `Hi,\n\nI hit an error in AriaDNA.\n\nWhat I was doing:\n- \n\nError: ${error?.message || error}\n\nBrowser: ${navigator.userAgent}\nPage: ${location.href}\n`
    )

    return (
      <div style={{
        position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
        background:'#f4f7ff', padding:24,
      }}>
        <div style={{
          maxWidth:460, width:'100%', background:'#fff', border:'1px solid #d8e2f3',
          borderRadius:16, padding:'30px 30px 26px', boxShadow:'0 20px 50px rgba(20,50,120,.12)', textAlign:'center',
        }}>
          <div style={{
            width:52, height:52, borderRadius:13, margin:'0 auto 16px', display:'grid', placeItems:'center',
            background:'linear-gradient(140deg,#ffe7d1,#ffd3b0)', border:'1px solid #ffc59a',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
              <path d="M12 9v4"/><path d="M12 17h.01"/>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
            </svg>
          </div>
          <h2 style={{ fontFamily:'"IBM Plex Sans",sans-serif', fontSize:20, fontWeight:800, color:'#0f2460', margin:'0 0 8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize:14, color:'#5a7ec0', lineHeight:1.55, margin:'0 0 6px' }}>
            This view hit an unexpected error. Your other tabs and data are safe — you can try again or reload.
          </p>
          {error?.message && (
            <p style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:11.5, color:'#94506a',
              background:'#fff0f4', border:'1px solid #ffd9e3', borderRadius:8, padding:'8px 10px', margin:'12px 0 18px', wordBreak:'break-word' }}>
              {String(error.message).slice(0,200)}
            </p>
          )}
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={this.reset} style={{
              padding:'10px 18px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:13.5,
              background:'linear-gradient(105deg,#1a56db,#0ea5d4)', color:'#fff', boxShadow:'0 8px 20px rgba(26,86,219,.26)',
            }}>Try again</button>
            <button onClick={() => location.reload()} style={{
              padding:'10px 18px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13.5,
              background:'#eef3fc', color:'#0f2460', border:'1px solid #d8e2f3',
            }}>Reload app</button>
          </div>
          <a href={`mailto:sudosudev@outlook.com?subject=${subject}&body=${body}`}
            style={{ display:'inline-block', marginTop:16, fontSize:12.5, color:'#1a56db', fontWeight:600 }}>
            Report this bug ↗
          </a>
        </div>
      </div>
    )
  }
}