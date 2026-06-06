import { useRef, useEffect, useCallback } from 'react'
import { collectLeaves, assignCircularCoords } from '../../../utils/treeHelpers'

export default function CircularTree({ root, width, height, highlight, onLeafClick, opts, annotGroups=[] }) {
  const canvasRef = useRef()
  const R=Math.min(width,height)/2-100, cx=width/2, cy=height/2
  const { nodeSize=3.5, fontSize=9.5, lineColor='#b8cfef', leafColor='#1a56db' } = opts||{}

  const draw = useCallback(() => {
    const canvas=canvasRef.current; if (!canvas||!root) return
    const dpr=window.devicePixelRatio||1
    canvas.width=width*dpr; canvas.height=height*dpr
    canvas.style.width=width+'px'; canvas.style.height=height+'px'
    const ctx=canvas.getContext('2d')
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height)
    ctx.translate(cx,cy)
    const tree=JSON.parse(JSON.stringify(root))
    assignCircularCoords(tree,R)
    function dn(node) {
      const isLeaf=!node.children?.length, isHL=node.name===highlight
      for (const child of (node.children||[])) {
        ctx.strokeStyle=lineColor; ctx.lineWidth=1.2
        ctx.beginPath(); ctx.moveTo(node._x,node._y); ctx.lineTo(child._x,child._y); ctx.stroke()
        dn(child)
      }
      ctx.beginPath()
      ctx.arc(node._x,node._y, isHL?nodeSize*1.8:isLeaf?nodeSize:nodeSize*0.6, 0, Math.PI*2)
      ctx.fillStyle=isHL?'#ffe000':isLeaf?leafColor:'#93b4f0'; ctx.fill()
      if (isHL) { ctx.strokeStyle='#cc9000'; ctx.lineWidth=1.5; ctx.stroke() }
      if (isLeaf&&node._angle!==undefined) {
        const lr=R+12, lx=lr*Math.cos(node._angle), ly=lr*Math.sin(node._angle)
        ctx.save(); ctx.translate(lx,ly)
        const flip=node._angle>Math.PI/2&&node._angle<3*Math.PI/2
        ctx.rotate(node._angle+(flip?Math.PI:0))
        ctx.font=`${isHL?'bold ':''}${fontSize}px "IBM Plex Sans",sans-serif`
        ctx.fillStyle=isHL?'#7a5500':'#0f2460'
        ctx.textAlign=flip?'right':'left'; ctx.textBaseline='middle'
        ctx.fillText(node.name.slice(0,22),0,0); ctx.restore()
      }
    }
    dn(tree); ctx.setTransform(1,0,0,1,0,0)
  }, [root,width,height,highlight,R,cx,cy,nodeSize,fontSize,lineColor,leafColor])

  useEffect(() => { requestAnimationFrame(draw) }, [draw])

  const handleClick = (e) => {
    const rect=canvasRef.current.getBoundingClientRect()
    const mx=e.clientX-rect.left-cx, my=e.clientY-rect.top-cy
    const clone=JSON.parse(JSON.stringify(root))
    assignCircularCoords(clone,R)
    for (const l of collectLeaves(clone)) {
      if (Math.hypot(l._x-mx,l._y-my)<9) { onLeafClick?.(l.name); return }
    }
  }
  return <canvas ref={canvasRef} style={{ display:'block', cursor:'crosshair' }} onClick={handleClick}/>
}

// ─────────────────────────────────────────────────────────────────────────────
//  MST / FORCE GRAPH
// ─────────────────────────────────────────────────────────────────────────────
// Draw annotation group overlays on force graph
