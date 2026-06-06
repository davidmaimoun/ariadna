import { useRef, useEffect, useCallback } from 'react'
import { collectLeaves, assignRectCoords } from '../../../utils/treeHelpers'

export default function RectTree({ root, width, height, highlight, onLeafClick, opts, annotGroups=[] }) {
  const canvasRef = useRef()
  const PAD = { top:20, right:200, bottom:30, left:50 }
  const { nodeSize=3.5, fontSize=10.5, branchFontSize=8, lineColor='#b8cfef', leafColor='#1a56db' } = opts||{}

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas||!root) return
    const dpr = window.devicePixelRatio||1
    canvas.width=width*dpr; canvas.height=height*dpr
    canvas.style.width=width+'px'; canvas.style.height=height+'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height)
    const W=width-PAD.left-PAD.right, H=height-PAD.top-PAD.bottom
    const tree = JSON.parse(JSON.stringify(root))
    assignRectCoords(tree, W, H)
    const maxD = Math.max(...collectLeaves(tree).map(l=>l._depth),1)
    ctx.translate(PAD.left, PAD.top)
    function dn(node) {
      const isLeaf=!node.children?.length, isHL=node.name===highlight
      for (const child of (node.children||[])) {
        ctx.strokeStyle=lineColor; ctx.lineWidth=1.2
        ctx.beginPath(); ctx.moveTo(node._x,node._y); ctx.lineTo(child._x,node._y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(child._x,node._y); ctx.lineTo(child._x,child._y); ctx.stroke()
        dn(child)
      }
      ctx.beginPath()
      ctx.arc(node._x,node._y, isHL?nodeSize*1.8:isLeaf?nodeSize:nodeSize*0.6, 0, Math.PI*2)
      ctx.fillStyle=isHL?'#ffe000':isLeaf?leafColor:'#93b4f0'; ctx.fill()
      if (isHL) { ctx.strokeStyle='#cc9000'; ctx.lineWidth=1.5; ctx.stroke() }
      if (isLeaf) {
        ctx.font=`${isHL?'bold ':''}${fontSize}px "IBM Plex Sans",sans-serif`
        ctx.fillStyle=isHL?'#7a5500':'#0f2460'
        ctx.textAlign='left'; ctx.textBaseline='middle'
        ctx.fillText(node.name.slice(0,38), node._x+7, node._y)
      }
      if (node.support!=null&&!isLeaf&&branchFontSize>0) {
        ctx.font=`${branchFontSize}px "JetBrains Mono",monospace`; ctx.fillStyle='#93b4f0'
        ctx.textAlign='left'; ctx.textBaseline='bottom'
        ctx.fillText(node.support, node._x+2, node._y-2)
      }
      // branch length — draw midway on the horizontal segment for all nodes with length
      if (node.length>0&&branchFontSize>0&&node._parentX!==undefined) {
        const midX = (node._x + node._parentX) / 2
        ctx.font=`${Math.max(7,branchFontSize)}px "JetBrains Mono",monospace`
        ctx.fillStyle='#7090c0'; ctx.textAlign='center'; ctx.textBaseline='bottom'
        ctx.fillText(node.length.toFixed(3), midX, node._y - 2)
      }
    }
    dn(tree); ctx.setTransform(1,0,0,1,0,0)
  }, [root,width,height,highlight,nodeSize,fontSize,branchFontSize,lineColor,leafColor])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const handleClick = (e) => {
    const rect=canvasRef.current.getBoundingClientRect()
    const mx=e.clientX-rect.left-PAD.left, my=e.clientY-rect.top-PAD.top
    const clone=JSON.parse(JSON.stringify(root))
    assignRectCoords(clone, width-PAD.left-PAD.right, height-PAD.top-PAD.bottom)
    for (const l of collectLeaves(clone)) {
      if (Math.abs(l._x-mx)<60&&Math.abs(l._y-my)<9) { onLeafClick?.(l.name); return }
    }
  }
  return <canvas ref={canvasRef} style={{ display:'block', cursor:'crosshair' }} onClick={handleClick}/>
}

