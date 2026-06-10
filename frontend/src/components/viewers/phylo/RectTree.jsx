import { useRef, useEffect, useCallback } from 'react'
import { collectLeaves, assignRectCoords } from '../../../utils/treeHelpers'

const PAD = { top:26, right:210, bottom:42, left:34 }

// iTOL-style rectangular cladogram/phylogram.
// Clean thin lines, square corners, NO junction dots, optional distance scale bar,
// aligned tips with faint dotted leader lines, branch-length labels off by default.
export default function RectTree({ root, width, height, highlight, onLeafClick, opts }) {
  const canvasRef = useRef()
  const {
    fontSize     = 12,
    lineColor    = '#3a3a3a',
    lineWidth    = 1,
    leafColor    = '#1a56db',
    alignTips    = true,
    cladogram    = false,
    showScale    = true,
    showNodes    = false,
    nodeSize     = 3,
    showBranchLen= false,
    branchFontSize = 8,
    showSupport  = false,
  } = opts || {}

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || !root) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width*dpr; canvas.height = height*dpr
    canvas.style.width = width+'px'; canvas.style.height = height+'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height)

    const W = width-PAD.left-PAD.right, H = height-PAD.top-PAD.bottom
    const tree = JSON.parse(JSON.stringify(root))
    assignRectCoords(tree, W, H, alignTips, cladogram)
    const leaves = collectLeaves(tree)
    const maxD = Math.max(...leaves.map(l=>l._depth), 1)

    ctx.translate(PAD.left, PAD.top)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'

    function dn(node) {
      const isLeaf = !node.children?.length
      const isHL = node.name===highlight
      for (const child of (node.children||[])) {
        ctx.strokeStyle = lineColor; ctx.lineWidth = lineWidth
        // horizontal from parent depth to child depth, then vertical connector
        ctx.beginPath(); ctx.moveTo(node._x, node._y); ctx.lineTo(child._x, node._y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(child._x, node._y); ctx.lineTo(child._x, child._y); ctx.stroke()

        // branch-length label sits ON the horizontal segment, with a crisp white background
        if (showBranchLen && child.length > 0 && (child._x - node._x) > 16) {
          const midX = (node._x + child._x) / 2
          const fs   = Math.max(8, branchFontSize)
          const txt  = child.length.toFixed(3)
          ctx.font = fs + 'px "JetBrains Mono",monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          const tw = ctx.measureText(txt).width
          // opaque white pad so the number never blurs into the branch line
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(midX - tw / 2 - 2, node._y - fs - 4, tw + 4, fs + 2)
          ctx.fillStyle = '#46587a'
          ctx.fillText(txt, midX, node._y - 3)
        }
        dn(child)
      }

      if (isLeaf) {
        const labelX = alignTips ? node._tipX : node._x
        // faint dotted leader to aligned label (iTOL style)
        if (alignTips && node._tipX > node._x + 0.5) {
          ctx.save()
          ctx.strokeStyle = '#d0d0d0'; ctx.lineWidth = 0.8; ctx.setLineDash([1,3])
          ctx.beginPath(); ctx.moveTo(node._x, node._y); ctx.lineTo(node._tipX, node._y); ctx.stroke()
          ctx.restore()
        }
        if (isHL) { // soft highlight band behind label row
          ctx.fillStyle = 'rgba(255,224,0,.28)'
          ctx.fillRect(node._x, node._y-fontSize*0.7, (labelX-node._x)+150, fontSize*1.4)
        }
        if (showNodes) { ctx.beginPath(); ctx.arc(node._x, node._y, nodeSize, 0, Math.PI*2); ctx.fillStyle=leafColor; ctx.fill() }
        ctx.font = `${isHL?'600 ':''}${fontSize}px "IBM Plex Sans",-apple-system,sans-serif`
        ctx.fillStyle = isHL ? '#7a5500' : '#1a1a1a'
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(node.name.slice(0,40), labelX+8, node._y)
      } else if (showNodes) {
        ctx.beginPath(); ctx.arc(node._x, node._y, nodeSize*0.7, 0, Math.PI*2); ctx.fillStyle='#9aa6c0'; ctx.fill()
      }

      // optional support value at internal node (crisp white background, no blur)
      if (showSupport && node.support != null && !isLeaf) {
        const fs  = Math.max(8, branchFontSize)
        const txt = String(node.support)
        ctx.font = fs + 'px "JetBrains Mono",monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        const tw = ctx.measureText(txt).width
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(node._x - 4 - tw - 2, node._y - fs - 4, tw + 4, fs + 2)
        ctx.fillStyle = '#7c3aed'
        ctx.fillText(txt, node._x - 4, node._y - 3)
      }
    }
    dn(tree)

    // ── Distance scale bar (iTOL "Tree scale") ───────────────────────────────
    if (showScale && !cladogram && maxD>0) {
      // pick a "nice" scale length ~ a tenth of the tree depth
      const target = maxD/5
      const pow = Math.pow(10, Math.floor(Math.log10(target)))
      const nice = [1,2,2.5,5,10].map(m=>m*pow).reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a)
      const px = (nice/maxD)*W
      const y = H + 22, x0 = 0
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(x0, y); ctx.lineTo(x0+px, y)
      ctx.moveTo(x0, y-3); ctx.lineTo(x0, y+3)
      ctx.moveTo(x0+px, y-3); ctx.lineTo(x0+px, y+3)
      ctx.stroke()
      ctx.font = '11px "IBM Plex Sans",sans-serif'; ctx.fillStyle = '#555'
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText(`Tree scale: ${nice}`, x0, y-6)
    }

    ctx.setTransform(1,0,0,1,0,0)
  }, [root,width,height,highlight,fontSize,lineColor,lineWidth,leafColor,alignTips,cladogram,showScale,showNodes,nodeSize,showBranchLen,branchFontSize,showSupport])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX-rect.left-PAD.left, my = e.clientY-rect.top-PAD.top
    const clone = JSON.parse(JSON.stringify(root))
    assignRectCoords(clone, width-PAD.left-PAD.right, height-PAD.top-PAD.bottom, alignTips, cladogram)
    for (const l of collectLeaves(clone)) {
      const lx = alignTips ? l._tipX : l._x
      if (mx>l._x-6 && mx<lx+150 && Math.abs(l._y-my)<9) { onLeafClick?.(l.name); return }
    }
  }
  return <canvas ref={canvasRef} style={{ display:'block', cursor:'pointer' }} onClick={handleClick}/>
}