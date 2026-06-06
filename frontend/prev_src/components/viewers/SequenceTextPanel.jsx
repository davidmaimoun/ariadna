import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '../../store/useStore'

const BLOCK = 10
const LINE  = 60
const ROW_H = 26
const OVER  = 6

// High-contrast nucleotide colors on white
const NUC_FG = { A:'#0a6e40', T:'#c0300e', G:'#1a3faa', C:'#8a5e00', U:'#c0300e' }
const NUC_BG = { A:'#d4f0de', T:'#fde0d0', G:'#d0e4ff', C:'#fff0c0', U:'#fde0d0' }

export default function SequenceTextPanel({ height }) {
  const {
    sequence, editedSequence, sequenceMeta,
    selection, viewStart, viewEnd,
    setSelection, jumpTo,
  } = useStore()

  const seq    = editedSequence || sequence || ''
  const seqLen = seq.length

  const scrollRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const selAnchor = useRef(null)

  const totalLines = Math.ceil(seqLen / LINE)
  const totalH     = totalLines * ROW_H

  // Auto-scroll to keep viewStart in view
  useEffect(() => {
    if (!scrollRef.current || !seqLen) return
    const targetLine = Math.floor(viewStart / LINE)
    const targetTop  = targetLine * ROW_H
    const el = scrollRef.current
    if (targetTop < el.scrollTop || targetTop > el.scrollTop + el.clientHeight - ROW_H * 3) {
      el.scrollTo({ top: Math.max(0, targetTop - ROW_H * 3), behavior: 'smooth' })
    }
  }, [viewStart, seqLen])

  const handleScroll = useCallback((e) => setScrollTop(e.currentTarget.scrollTop), [])
  const handleMD     = useCallback((pos) => { selAnchor.current = pos; setSelection({ start:pos, end:pos }); jumpTo(pos) }, [setSelection, jumpTo])
  const handleMO     = useCallback((pos) => { if (selAnchor.current===null) return; const a=selAnchor.current; setSelection({ start:Math.min(a,pos), end:Math.max(a,pos) }) }, [setSelection])
  const handleMU     = useCallback(() => { selAnchor.current = null }, [])

  if (!seq) return null

  const panelH = height - 32
  const first  = Math.max(0, Math.floor(scrollTop / ROW_H) - OVER)
  const last   = Math.min(totalLines - 1, Math.ceil((scrollTop + panelH) / ROW_H) + OVER)

  return (
    <div style={{ background:'#f8faff', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'4px 12px', background:'#dce8fb', borderBottom:'1px solid #c0d4f5', flexShrink:0 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#1a3faa', fontFamily:'"IBM Plex Sans",sans-serif' }}>Full Sequence</span>
        <span style={{ fontSize:10, color:'#93b4f0', fontFamily:'monospace' }}>
          {seqLen.toLocaleString()} bp · {BLOCK} bp blocks · {LINE} bp/line
        </span>
        <div style={{ flex:1 }} />
        {/* Block guide */}
        <div style={{ display:'flex', fontFamily:'"JetBrains Mono",monospace', fontSize:9, color:'#c0d4f5' }}>
          {Array.from({ length: LINE/BLOCK }, (_,i) => (
            <span key={i} style={{ width:'10ch', display:'inline-block', textAlign:'right', paddingRight:6 }}>
              {(i+1)*BLOCK}
            </span>
          ))}
        </div>
      </div>

      {/* Virtual scroll */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseUp={handleMU}
        onMouseLeave={handleMU}
        style={{ height:panelH, overflowY:'auto', overflowX:'hidden', position:'relative' }}
      >
        <div style={{ height:totalH, position:'relative' }}>
          {Array.from({ length: last - first + 1 }, (_, i) => {
            const li        = first + i
            const lineStart = li * LINE
            const lineSeq   = seq.slice(lineStart, lineStart + LINE)

            return (
              <div key={li} style={{
                position:'absolute', top:li*ROW_H, left:0, right:0, height:ROW_H,
                display:'flex', alignItems:'center',
                background: li%2===0 ? '#ffffff' : '#f5f8ff',
                borderBottom:'1px solid #eef3ff',
              }}>
                {/* Line number */}
                <span style={{
                  width:80, minWidth:80, textAlign:'right', paddingRight:10,
                  fontSize:11, fontFamily:'"JetBrains Mono",monospace',
                  color:'#93b4f0', fontWeight:600, userSelect:'none',
                  borderRight:'1px solid #e4edfb',
                }}>
                  {(lineStart+1).toLocaleString()}
                </span>

                {/* Nucleotide blocks */}
                <span style={{ paddingLeft:8, display:'flex', gap:8, fontFamily:'"JetBrains Mono",monospace', fontSize:14, letterSpacing:'1.5px' }}>
                  {Array.from({ length: Math.ceil(lineSeq.length/BLOCK) }, (_,bi) => {
                    const blockSeq   = lineSeq.slice(bi*BLOCK, (bi+1)*BLOCK)
                    const blockStart = lineStart + bi*BLOCK
                    return (
                      <span key={bi} style={{ whiteSpace:'pre' }}>
                        {blockSeq.split('').map((nuc, ni) => {
                          const pos   = blockStart + ni
                          const upper = nuc.toUpperCase()
                          const inSel = selection && pos >= selection.start && pos <= selection.end
                          const inVw  = pos >= viewStart && pos < viewEnd

                          return (
                            <span key={ni}
                              onMouseDown={() => handleMD(pos)}
                              onMouseOver={() => handleMO(pos)}
                              style={{
                                color:      NUC_FG[upper] || '#6a90c0',
                                fontWeight: NUC_FG[upper] ? 800 : 400,
                                // Selection → vivid yellow; viewport → light blue tint; normal → subtle nuc bg
                                background: inSel
                                  ? '#ffe000'                         // vivid yellow highlight
                                  : inVw
                                    ? 'rgba(26,63,170,0.10)'
                                    : (NUC_BG[upper] || 'transparent'),
                                borderRadius: 2,
                                cursor:'default',
                                padding:'0 0.5px',
                                // Yellow border for viewport when selected
                                outline: inSel
                                  ? '1px solid #cc9000'
                                  : inVw && !inSel
                                    ? '1px solid rgba(26,63,170,0.20)'
                                    : undefined,
                                // Drop shadow for selected nuc — makes it pop even more
                                boxShadow: inSel ? '0 1px 3px rgba(180,130,0,0.35)' : undefined,
                              }}
                            >{upper}</span>
                          )
                        })}
                      </span>
                    )
                  })}
                </span>

                {/* End position */}
                <span style={{ marginLeft:'auto', paddingRight:10, fontSize:11, fontFamily:'"JetBrains Mono",monospace', color:'#c0d4f5', userSelect:'none' }}>
                  {Math.min(lineStart+LINE, seqLen).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
