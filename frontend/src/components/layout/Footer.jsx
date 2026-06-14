export default function Footer() {
  const link = (href, children) => (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ display:'flex', alignItems:'center', gap:5, color:'#8aaad4', textDecoration:'none',
               transition:'color .15s', fontWeight:500 }}
      onMouseEnter={e=>e.currentTarget.style.color='#a0c8ff'}
      onMouseLeave={e=>e.currentTarget.style.color='#8aaad4'}>
      {children}
    </a>
  )
  return (
    <footer style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:18,
      padding:'5px 20px', flexShrink:0, height:30,
      background:'#1a2a4a',
      fontSize:11.5, color:'#6a8ab8',
      letterSpacing:'.01em',
    }}>
      <span>
        Powered by{' '}
        <a href="https://www.sudosudev.com" target="_blank" rel="noreferrer"
          style={{ color:'#4a9aff', textDecoration:'none', fontWeight:700 }}
          onMouseEnter={e=>e.currentTarget.style.color='#80c0ff'}
          onMouseLeave={e=>e.currentTarget.style.color='#4a9aff'}>
          sudosu.dev
        </a>
      </span>
      
      <span style={{ color:'#2a4a7a' }}>·</span>
      {link('https://linkedin.com/in/sudosu', (
        <>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          LinkedIn
        </>
      ))}

      <span style={{ color:'#2a4a7a' }}>·</span>
      {link('mailto:sudosudev@outlook.com', (
        <>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          sudosudev@outlook.com
        </>
      ))}

      <span style={{ color:'#2a4a7a' }}>·</span>
      <a href="https://paypal.me/sudosudev" target="_blank" rel="noreferrer"
        onClick={() => { try { fetch('/track?e=donate_click') } catch (e) { /* noop */ } }}
        style={{ display:'flex', alignItems:'center', gap:5, color:'#e0b34a', textDecoration:'none',
                 fontWeight:700, transition:'color .15s' }}
        onMouseEnter={e=>e.currentTarget.style.color='#ffd36b'}
        onMouseLeave={e=>e.currentTarget.style.color='#e0b34a'}>
        <span style={{ fontSize:12 }}>♥</span>
        Support
      </a>
    </footer>
  )
}