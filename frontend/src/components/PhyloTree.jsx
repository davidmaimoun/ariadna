import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { GitBranch, Circle, Network, X, Download, Upload, Info, Sliders } from 'lucide-react'
import { neighborJoining, upgma, mstKruskal, mstPrim, goeburst } from '../utils/treeAlgorithms'

// ─────────────────────────────────────────────────────────────────────────────
//  PARSERS
// ─────────────────────────────────────────────────────────────────────────────

function parseMetadata(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return {}
  const sep  = lines[0].includes('\t') ? '\t' : ','
  const keys = lines[0].split(sep).slice(1).map(k => k.trim())
  const meta = {}
  for (const line of lines.slice(1)) {
    const cols = line.split(sep)
    const name = cols[0].trim()
    meta[name] = {}
    keys.forEach((k, i) => { meta[name][k] = (cols[i+1]||'').trim() })
  }
  return meta
}

// ─────────────────────────────────────────────────────────────────────────────
//  TREE LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function collectLeaves(node) {
  if (!node.children?.length) return [node]
  return node.children.flatMap(collectLeaves)
}
function computeDepths(node, d=0) {
  node._depth = d
  for (const c of (node.children||[])) computeDepths(c, d+(c.length||0.01))
}
function assignRectCoords(root, W, H) {
  computeDepths(root, 0)
  const leaves = collectLeaves(root)
  const rowH   = H / leaves.length
  leaves.forEach((l,i) => { l._y = (i+0.5)*rowH })
  const maxD = Math.max(...leaves.map(l=>l._depth), 1)
  function lay(n, parentX) {
    n._x       = (n._depth/maxD)*W
    n._parentX = parentX  // parent's x for drawing branch length label
    if (!n.children?.length) return
    n.children.forEach(c => lay(c, n._x))
    n._y = (n.children[0]._y + n.children[n.children.length-1]._y)/2
  }
  lay(root, 0)
}
function assignCircularCoords(root, R) {
  computeDepths(root, 0)
  const leaves = collectLeaves(root)
  const step   = (2*Math.PI)/leaves.length
  const maxD   = Math.max(...leaves.map(l=>l._depth), 1)
  leaves.forEach((l,i) => { l._angle = i*step - Math.PI/2 })
  function lay(n) {
    const r = (n._depth/maxD)*R
    if (!n.children?.length) { n._x=r*Math.cos(n._angle); n._y=r*Math.sin(n._angle); return }
    n.children.forEach(lay)
    const angs = collectLeaves(n).map(l=>l._angle)
    n._angle = (Math.min(...angs)+Math.max(...angs))/2
    n._x=r*Math.cos(n._angle); n._y=r*Math.sin(n._angle)
  }
  lay(root)
}
function treeStats(root) {
  const cl = JSON.parse(JSON.stringify(root))
  computeDepths(cl)
  const lv = collectLeaves(cl)
  const dp = lv.map(l=>l._depth)
  return { leaves:lv.length, maxDepth:Math.max(...dp).toFixed(5), minDepth:Math.min(...dp).toFixed(5) }
}

// ─────────────────────────────────────────────────────────────────────────────
//  RECTANGULAR TREE
// ─────────────────────────────────────────────────────────────────────────────
function RectTree({ root, width, height, highlight, onLeafClick, opts, annotGroups=[] }) {
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

// ─────────────────────────────────────────────────────────────────────────────
//  CIRCULAR TREE
// ─────────────────────────────────────────────────────────────────────────────
function CircularTree({ root, width, height, highlight, onLeafClick, opts, annotGroups=[] }) {
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
function drawAnnotGroups(g, nodes, annotGroups) {
  g.selectAll('.annot-group').remove()
  if (!annotGroups || !annotGroups.length) return
  const nodeByName = Object.fromEntries(nodes.map(n=>[n.name,n]))
  for (const grp of annotGroups) {
    if (!grp.nodes.length) continue
    const pts = grp.nodes.map(n=>nodeByName[n]).filter(Boolean)
    if (!pts.length) continue
    const PAD = 28
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y)
    const x1=Math.min(...xs)-PAD, y1=Math.min(...ys)-PAD
    const x2=Math.max(...xs)+PAD, y2=Math.max(...ys)+PAD
    const cx=(x1+x2)/2, cy=(y1+y2)/2, rx=(x2-x1)/2, ry=(y2-y1)/2
    const grpEl = g.append('g').attr('class','annot-group')

    if (grp.shape==='ellipse') {
      grpEl.append('ellipse')
        .attr('cx',cx).attr('cy',cy).attr('rx',rx).attr('ry',ry)
        .attr('fill',grp.color).attr('fill-opacity',grp.opacity)
        .attr('stroke',grp.color).attr('stroke-width',2).attr('stroke-opacity',0.7)
    } else if (grp.shape==='rect') {
      grpEl.append('rect')
        .attr('x',x1).attr('y',y1).attr('width',x2-x1).attr('height',y2-y1).attr('rx',10)
        .attr('fill',grp.color).attr('fill-opacity',grp.opacity)
        .attr('stroke',grp.color).attr('stroke-width',2).attr('stroke-opacity',0.7)
    } else if (grp.shape==='cloud') {
      // Approximate cloud with multiple overlapping circles
      const step = Math.max(1, Math.floor(pts.length/4))
      for (let i=0;i<pts.length;i+=step) {
        grpEl.append('circle')
          .attr('cx',pts[i].x).attr('cy',pts[i].y).attr('r',PAD*1.4)
          .attr('fill',grp.color).attr('fill-opacity',grp.opacity*0.8)
          .attr('stroke','none')
      }
      // Central hull
      grpEl.append('ellipse')
        .attr('cx',cx).attr('cy',cy).attr('rx',rx*0.7).attr('ry',ry*0.7)
        .attr('fill',grp.color).attr('fill-opacity',grp.opacity)
        .attr('stroke',grp.color).attr('stroke-width',1.5).attr('stroke-opacity',0.5)
    }

    // Label
    if (grp.label) {
      grpEl.append('text')
        .attr('x', cx).attr('y', y1-6)
        .attr('text-anchor','middle').attr('font-size',12).attr('font-weight',700)
        .attr('fill', grp.color).attr('font-family', '"IBM Plex Sans",sans-serif')
        .attr('stroke','#fff').attr('stroke-width',3).attr('paint-order','stroke')
        .text(grp.label)
    }
  }
}

function ForceGraph({ graph, width, height, highlight, onNodeClick, meta, opts, annotGroups=[] }) {
  const svgRef  = useRef()
  const simRef  = useRef(null)
  const selRef  = useRef({})   // d3 selections persisted across renders
  const posRef  = useRef([])   // node positions preserved across re-renders

  const { nodeSize=8, fontSize=10, lineColor='#b8cfef', leafColor='#1a56db',
          metaField=null, nodeLabelField=null } = opts||{}

  const metaColorScale = useMemo(() => {
    if (!meta||!metaField||!graph) return null
    const vals = [...new Set(graph.nodes.map(n=>meta[n.name]?.[metaField]).filter(Boolean))]
    return Object.fromEntries(vals.map((v,i)=>[v, d3.schemeTableau10[i%10]]))
  }, [meta, metaField, graph])

  const getColor = useCallback((n) => {
    if (n.name===highlight) return '#ffe000'
    if (metaColorScale&&metaField) return metaColorScale[meta?.[n.name]?.[metaField]]||leafColor
    return leafColor
  }, [highlight, metaColorScale, metaField, leafColor, meta])

  const getLabel = useCallback((n) => {
    const lbl = nodeLabelField && meta?.[n.name]?.[nodeLabelField]
    const name = lbl || n.name
    return name.length>24 ? name.slice(0,22)+'…' : name
  }, [nodeLabelField, meta])

  // ── Effect 1: Full D3 setup — only when graph or size changes ─────────────
  useEffect(() => {
    if (!graph||!svgRef.current) return
    if (simRef.current) simRef.current.stop()

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const maxW    = d3.max(graph.edges, e=>e.weight)||1
    const lenScale= d3.scaleLinear().domain([0,maxW]).range([40,220])

    // Restore pinned positions from previous layout of same graph
    const prevById = Object.fromEntries(posRef.current.map(n=>[n.id,n]))
    const nodes = graph.nodes.map(n => {
      const p = prevById[n.id]
      return p
        ? { ...n, x:p.x, y:p.y, fx:p.fx??null, fy:p.fy??null }
        : { ...n, x:width/2+(Math.random()-.5)*300, y:height/2+(Math.random()-.5)*300 }
    })
    const nodeById= Object.fromEntries(nodes.map(n=>[n.id,n]))
    const edges   = graph.edges.map(e=>({ source:nodeById[e.source], target:nodeById[e.target], weight:e.weight }))

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.05,15]).on('zoom', e=>g.attr('transform',e.transform)))

    const link = g.append('g').attr('class','links').selectAll('line').data(edges).join('line')
      .attr('class','edge-line').attr('stroke',lineColor).attr('stroke-width',1.8)

    const wLabel = g.append('g').attr('class','elabels').selectAll('text').data(edges).join('text')
      .attr('class','edge-label').attr('font-size',9).attr('fill','#93b4f0')
      .attr('font-family','"JetBrains Mono",monospace').attr('text-anchor','middle')
      .text(d=>d.weight>0?(Number.isInteger(d.weight)?d.weight:d.weight.toFixed(2)):'')

    const node = g.append('g').attr('class','nodes').selectAll('circle').data(nodes).join('circle')
      .attr('class','node-circle')
      .attr('r', d=>d.name===highlight?nodeSize*1.5:nodeSize)
      .attr('fill', getColor).attr('stroke','#fff').attr('stroke-width',1.5)
      .style('cursor','pointer')
      .on('click', (_,d)=>onNodeClick?.(d.name))
      .call(d3.drag()
        // gentle alpha so dragging doesn't re-animate the whole graph
        .on('start',(ev,d)=>{ if(!ev.active)sim.alphaTarget(0.05).restart(); d.fx=d.x; d.fy=d.y })
        .on('drag', (ev,d)=>{ d.fx=ev.x; d.fy=ev.y })
        // keep pinned after drag (user placed it intentionally)
        .on('end',  (ev,d)=>{ if(!ev.active)sim.alphaTarget(0) })
      )

    const label = g.append('g').attr('class','labels').selectAll('text').data(nodes).join('text')
      .attr('class','node-label')
      .attr('font-size', fontSize)
      .attr('font-weight',d=>d.name===highlight?700:400)
      .attr('fill',d=>d.name===highlight?'#7a5500':'#0f2460')
      .attr('font-family','"IBM Plex Sans",sans-serif')
      .attr('dy',-(nodeSize+4)).attr('text-anchor','middle')
      .text(getLabel)

    const sim = d3.forceSimulation(nodes)
      .force('link',   d3.forceLink(edges).id(d=>d.id).distance(d=>lenScale(d.weight)))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width/2, height/2))
      .force('collide',d3.forceCollide(nodeSize*3.5))

    simRef.current = sim
    selRef.current = { link, wLabel, node, label }

    sim.on('tick',()=>{
      link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y)
          .attr('x2',d=>d.target.x).attr('y2',d=>d.target.y)
      wLabel.attr('x',d=>(d.source.x+d.target.x)/2).attr('y',d=>(d.source.y+d.target.y)/2-4)
      node.attr('cx',d=>d.x).attr('cy',d=>d.y)
      label.attr('x',d=>d.x).attr('y',d=>d.y)
    })
    sim.on('end', ()=>{ posRef.current = nodes })  // save positions when settled

    return () => { sim.stop(); posRef.current = nodes }
  }, [graph, width, height])  // ← NO opts/highlight in deps — avoids re-animation!

  // ── Effect 2: Update visuals only — no simulation restart ─────────────────
  useEffect(() => {
    const { link, node, label } = selRef.current
    if (!node || !label) return
    node
      .attr('r',    d => d.name===highlight ? nodeSize*1.5 : nodeSize)
      .attr('fill', getColor)
    label
      .attr('font-size',   fontSize)
      .attr('font-weight', d => d.name===highlight ? 700 : 400)
      .attr('fill',        d => d.name===highlight ? '#7a5500' : '#0f2460')
      .attr('dy',          -(nodeSize+4))
      .text(getLabel)
    if (link) link.attr('stroke', lineColor)
  }, [highlight, nodeSize, fontSize, leafColor, lineColor, getColor, getLabel])

  return <svg ref={svgRef} width={width} height={height}
    style={{ display:'block', background:'#fff', cursor:'grab' }}/>
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALGORITHM SELECTOR + UPLOAD — shown when no data loaded
// ─────────────────────────────────────────────────────────────────────────────
const ALGOS = [
  { id:'mst-kruskal', label:'MST — Kruskal',      icon:<Network size={22}/>,  color:'#1a56db', accepts:'.tsv,.csv,.txt,.tab', type:'graph', desc:'Minimum spanning tree. Classic, fast, robust.' },
  { id:'mst-prim',    label:'MST — Prim',          icon:<Network size={22}/>,  color:'#0e8c9e', accepts:'.tsv,.csv,.txt,.tab', type:'graph', desc:'Alternative MST. Identical result, different traversal.' },
  { id:'goeburst',    label:'GoeBURST',             icon:<Network size={22}/>,  color:'#6b40a8', accepts:'.tsv,.csv,.txt,.tab', type:'graph', desc:'Prioritises founders by SLV count. Ideal for MLST/cgMLST.' },
  { id:'nj',          label:'Neighbor-Joining',     icon:<GitBranch size={22}/>,color:'#0a6e40', accepts:'.tsv,.csv,.txt,.tab', type:'tree',  desc:'Classic phylogenetic tree. Good for evolutionary inference.' },
  { id:'upgma',       label:'UPGMA',                icon:<GitBranch size={22}/>,color:'#cc7000', accepts:'.tsv,.csv,.txt,.tab', type:'tree',  desc:'Ultrametric tree assuming constant evolution rate.' },
  { id:'nwk',         label:'Load Newick (.nwk)',   icon:<GitBranch size={22}/>,color:'#c0300e', accepts:'.nwk,.tre,.tree,.nex', type:'newick',desc:'Import a pre-computed tree in Newick format.' },
]

function AlgoSelector({ onSelect, loading, loadingMsg, loadingPct }) {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f7ff', overflow:'auto' }}>
      <div style={{ maxWidth:700, width:'100%', padding:40 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <GitBranch size={44} color="#1a56db" style={{ marginBottom:10 }}/>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#0f2460', margin:'0 0 6px', fontFamily:'"IBM Plex Sans",sans-serif' }}>
            Phylogenetic Tree Viewer
          </h2>
          <p style={{ fontSize:13.5, color:'#5a7ec0', margin:0 }}>
            Choose an algorithm, then upload your data file
          </p>
        </div>

        {loading && (
          <div style={{ marginBottom:24, padding:'12px 16px', background:'#dce8fb', borderRadius:10, border:'1px solid #93b4f0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              {[0,1,2].map(i=><div key={i} className="loading-dot" style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent)' }}/>)}
              <span style={{ fontSize:13, color:'#1a3faa', fontWeight:600 }}>{loadingMsg}</span>
            </div>
            <div style={{ height:5, background:'#93b4f0', borderRadius:3, overflow:'hidden' }}>
              <div style={{ width:loadingPct+'%', height:'100%', background:'linear-gradient(90deg,#1a56db,#4a82e4)', transition:'width .2s', borderRadius:3 }}/>
            </div>
            <span style={{ fontSize:11, color:'#5a7ec0' }}>{loadingPct}%</span>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
          {ALGOS.map(algo => {
            const fileRef = React.createRef()
            return (
              <div key={algo.id}>
                <input type="file" ref={fileRef} accept={algo.accepts} style={{ display:'none' }}
                  onChange={e => { const f=e.target.files[0]; if(f) onSelect(algo.id, f, algo.type); e.target.value='' }}/>
                <button onClick={() => fileRef.current.click()} style={{
                  width:'100%', padding:'18px 14px', borderRadius:12, textAlign:'center',
                  border:`2px solid #c0d4f5`, background:'#fff', cursor:'pointer',
                  transition:'all .15s', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=algo.color; e.currentTarget.style.boxShadow=`0 4px 16px ${algo.color}22` }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor='#c0d4f5'; e.currentTarget.style.boxShadow='none' }}
                >
                  <span style={{ color:algo.color }}>{algo.icon}</span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:'#0f2460', lineHeight:1.2 }}>{algo.label}</span>
                  <span style={{ fontSize:10.5, color:'#5a7ec0', lineHeight:1.4 }}>{algo.desc}</span>
                  <span style={{ fontSize:10, color:'#93b4f0', fontFamily:'"JetBrains Mono",monospace' }}>{algo.accepts}</span>
                </button>
              </div>
            )
          })}
        </div>
        <p style={{ textAlign:'center', fontSize:11.5, color:'#93b4f0', marginTop:20 }}>
          💡 Supports chewBBACA allelic profiles — Hamming distances computed automatically
        </p>
      </div>
    </div>
  )
}

// Need React for createRef
import React from 'react'
import { parseNewick, parseDistanceMatrix, buildMST } from '../utils/phyloUtils'

// ─────────────────────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
//  DRAWING OVERLAY — SVG layer on top of any tree canvas
//  Drag to draw ellipse or rectangle, click existing to select/edit/delete
// ─────────────────────────────────────────────────────────────────────────────
const DRAW_COLORS = ['#1a56db','#c0300e','#0a6e40','#cc7000','#6b40a8','#0e8c9e','#e05080']

function DrawOverlay({ width, height, shapes, setShapes, drawMode, drawShape, activeColor, opacity }) {
  const svgRef    = useRef()
  const isDrawing = useRef(false)
  const startPt   = useRef(null)
  const [draft,     setDraft]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [textPos,   setTextPos]   = useState(null)
  const dragRef = useRef(null)   // { id, ox, oy, startX, startY, handle } for dragging/resizing

  const getPos = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const src  = e.touches?.[0] ?? e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const onDown = (e) => {
    if (!drawMode) return
    if (drawShape === 'text') { setTextPos(getPos(e)); setSelected(null); return }
    if (e.target !== svgRef.current) return
    e.preventDefault()
    isDrawing.current = true
    startPt.current   = getPos(e)
    setDraft(null); setSelected(null)
  }
  const onMove = (e) => {
    if (!isDrawing.current || !startPt.current) return
    e.preventDefault()
    const p = getPos(e)
    setDraft({ x1:Math.min(startPt.current.x,p.x), y1:Math.min(startPt.current.y,p.y),
               x2:Math.max(startPt.current.x,p.x), y2:Math.max(startPt.current.y,p.y) })
  }
  const onUp = (e) => {
    if (!isDrawing.current || !startPt.current) return
    isDrawing.current = false
    const src  = e.changedTouches?.[0] ?? e
    const rect = svgRef.current.getBoundingClientRect()
    const p    = { x: src.clientX-rect.left, y: src.clientY-rect.top }
    const x1=Math.min(startPt.current.x,p.x), y1=Math.min(startPt.current.y,p.y)
    const x2=Math.max(startPt.current.x,p.x), y2=Math.max(startPt.current.y,p.y)
    startPt.current = null
    if (x2-x1 < 6 && y2-y1 < 6) { setDraft(null); return }
    const s = { id:Date.now(), type:drawShape, x1,y1,x2,y2, color:activeColor, opacity, label:'' }
    setShapes(prev=>[...prev,s])
    setSelected(s.id); setEditLabel('')
    setDraft(null)
  }

  const placeText  = (text) => {
    if (!text?.trim() || !textPos) return
    setShapes(prev=>[...prev,{ id:Date.now(), type:'text', x:textPos.x, y:textPos.y,
      color:activeColor, opacity:1, label:text, fontSize:15 }])
    setTextPos(null)
  }
  const deleteShape = (id) => { setShapes(prev=>prev.filter(s=>s.id!==id)); setSelected(null) }
  const updateLabel = (id, lbl) => {
    setShapes(prev=>prev.map(s=>s.id===id?{...s,label:lbl}:s))
    setEditLabel(lbl)
  }
  const onClickShape = (e, s) => {
    e.stopPropagation()
    if (drawMode) return
    setSelected(s.id); setEditLabel(s.label||'')
  }

  const selShape = shapes.find(s=>s.id===selected)

  const mkShape = (s, transparent=false) => {
    const cx=(s.x1+s.x2)/2, cy=(s.y1+s.y2)/2
    const rx=Math.max(1,(s.x2-s.x1)/2), ry=Math.max(1,(s.y2-s.y1)/2)
    const common = transparent
      ? { fill:'transparent', stroke:'transparent', strokeWidth:12, style:{cursor:'pointer'}, onClick:(e)=>onClickShape(e,s) }
      : { fill:s.color, fillOpacity:s.opacity, stroke:s.color, strokeWidth:selected===s.id?2.5:1.8, strokeOpacity:0.9, style:{cursor:'pointer'}, onClick:(e)=>onClickShape(e,s) }
    return s.type==='rect'
      ? <rect key={s.id+(transparent?'h':'')} x={s.x1} y={s.y1} width={s.x2-s.x1} height={s.y2-s.y1} rx={10} {...common}/>
      : <ellipse key={s.id+(transparent?'h':'')} cx={cx} cy={cy} rx={rx} ry={ry} {...common}/>
  }

  return (
    <>
      {/* Visual SVG overlay — always visible, pointer events only in draw mode */}
      <svg ref={svgRef} width={width} height={height}
        style={{
          position:'absolute', top:0, left:0, zIndex:10,
          cursor:drawMode?(drawShape==='text'?'text':'crosshair'):'default',
          pointerEvents:drawMode?'all':'none',
          userSelect:'none',
        }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        {shapes.map(s => s.type==='text' ? (
          <text key={s.id} x={s.x} y={s.y} fill={s.color} fontSize={s.fontSize||15}
            fontWeight={700} fontFamily='"IBM Plex Sans",sans-serif'
            stroke="white" strokeWidth={3} paintOrder="stroke">{s.label}</text>
        ) : (
          <g key={s.id}>
            {mkShape(s)}
            {s.label && (
              <text x={(s.x1+s.x2)/2} y={s.y1-6} textAnchor="middle" fontSize={13}
                fontWeight={700} fontFamily='"IBM Plex Sans",sans-serif'
                fill={s.color} stroke="white" strokeWidth={3} paintOrder="stroke">{s.label}</text>
            )}
            {selected===s.id && (
              <>
                {/* Delete button — in visual layer, always visible */}
                <circle cx={s.x2+6} cy={s.y1-6} r={10} fill="#c0300e" stroke="white" strokeWidth={1.5}
                  style={{cursor:'pointer',pointerEvents:'none'}}/>
                <text x={s.x2+6} y={s.y1-6} textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fill="white" fontWeight={800} style={{pointerEvents:'none'}}>✕</text>
                {/* Resize corner dots — visual only, interaction is in hit-test SVG */}
                {[[s.x1,s.y1],[s.x2,s.y1],[s.x1,s.y2],[s.x2,s.y2]].map(([hx,hy],i)=>(
                  <rect key={i} x={hx-5} y={hy-5} width={10} height={10} rx={2}
                    fill="white" stroke={s.color} strokeWidth={2} style={{pointerEvents:'none'}}/>
                ))}
              </>
            )}
          </g>
        ))}
        {draft && (
          draft.x2-draft.x1>0&&draft.y2-draft.y1>0&&(
            drawShape==='rect'
              ? <rect x={draft.x1} y={draft.y1} width={draft.x2-draft.x1} height={draft.y2-draft.y1}
                  rx={10} fill={activeColor} fillOpacity={0.12} stroke={activeColor} strokeWidth={2} strokeDasharray="8,4"/>
              : <ellipse cx={(draft.x1+draft.x2)/2} cy={(draft.y1+draft.y2)/2}
                  rx={(draft.x2-draft.x1)/2} ry={(draft.y2-draft.y1)/2}
                  fill={activeColor} fillOpacity={0.12} stroke={activeColor} strokeWidth={2} strokeDasharray="8,4"/>
          )
        )}
      </svg>

      {/* Invisible hit-test + drag layer — for clicking/dragging shapes when NOT in draw mode */}
      {!drawMode && shapes.length>0 && (
        <svg width={width} height={height}
          style={{ position:'absolute', top:0, left:0, zIndex:12, pointerEvents:'all',
                   userSelect:'none', background:'transparent', cursor: dragRef.current ? 'grabbing' : 'default' }}
          onClick={(e)=>{ if(e.target.tagName==='svg') setSelected(null) }}
          onMouseMove={(e)=>{
            if (!dragRef.current) return
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX-rect.left, my = e.clientY-rect.top
            const dx = mx - dragRef.current.startX, dy = my - dragRef.current.startY
            const h  = dragRef.current.handle
            setShapes(prev=>prev.map(s=>{
              if (s.id !== dragRef.current.id) return s
              if (s.type==='text') return { ...s, x:dragRef.current.ox+dx, y:dragRef.current.oy+dy }
              if (!h) return { ...s, x1:dragRef.current.ox+dx, y1:dragRef.current.oy+dy,
                            x2:dragRef.current.ox+dx+(dragRef.current.w||0),
                            y2:dragRef.current.oy+dy+(dragRef.current.h||0) }
              // Resize by handle
              const MIN=20
              let {x1,y1,x2,y2} = dragRef.current.orig
              if (h==='nw') { x1=Math.min(x2-MIN,x1+dx); y1=Math.min(y2-MIN,y1+dy) }
              if (h==='ne') { x2=Math.max(x1+MIN,x2+dx); y1=Math.min(y2-MIN,y1+dy) }
              if (h==='sw') { x1=Math.min(x2-MIN,x1+dx); y2=Math.max(y1+MIN,y2+dy) }
              if (h==='se') { x2=Math.max(x1+MIN,x2+dx); y2=Math.max(y1+MIN,y2+dy) }
              return { ...s, x1, y1, x2, y2 }
            }))
          }}
          onMouseUp={()=>{ dragRef.current=null }}
          onMouseLeave={()=>{ dragRef.current=null }}
        >
          {shapes.map(s => {
            const makeDrag = (handle=null) => (e) => {
              e.stopPropagation()
              setSelected(s.id); setEditLabel(s.label||'')
              const rect = e.currentTarget.closest('svg').getBoundingClientRect()
              dragRef.current = {
                id:s.id, handle,
                startX:e.clientX-rect.left, startY:e.clientY-rect.top,
                ox:s.type==='text'?s.x:s.x1, oy:s.type==='text'?s.y:s.y1,
                w:s.type==='text'?0:(s.x2-s.x1), h:s.type==='text'?0:(s.y2-s.y1),
                orig:s.type==='text'?null:{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2},
              }
            }
            const isSel = s.id===selected
            return (
              <g key={s.id}>
                {/* Body — drag to move */}
                {s.type==='text'
                  ? <text x={s.x} y={s.y} fill="transparent" stroke="transparent" strokeWidth={14}
                      fontSize={s.fontSize||15} style={{cursor:'grab'}} onMouseDown={makeDrag()}>{s.label}</text>
                  : s.type==='rect'
                    ? <rect x={s.x1} y={s.y1} width={Math.max(1,s.x2-s.x1)} height={Math.max(1,s.y2-s.y1)}
                        rx={10} fill="transparent" stroke="transparent" strokeWidth={12}
                        style={{cursor:'grab'}} onMouseDown={makeDrag()}/>
                    : <ellipse cx={(s.x1+s.x2)/2} cy={(s.y1+s.y2)/2}
                        rx={Math.max(1,(s.x2-s.x1)/2)} ry={Math.max(1,(s.y2-s.y1)/2)}
                        fill="transparent" stroke="transparent" strokeWidth={12}
                        style={{cursor:'grab'}} onMouseDown={makeDrag()}/>
                }
                {/* Delete + resize handles — only when selected, in interactive layer */}
                {isSel && s.type!=='text' && (
                  <>
                    {/* Delete */}
                    <circle cx={s.x2+6} cy={s.y1-6} r={11} fill="transparent"
                      style={{cursor:'pointer'}} onClick={(e)=>{e.stopPropagation();deleteShape(s.id)}}/>
                    {/* Resize corners */}
                    {[['nw',s.x1,s.y1,'nwse-resize'],['ne',s.x2,s.y1,'nesw-resize'],
                      ['sw',s.x1,s.y2,'nesw-resize'],['se',s.x2,s.y2,'nwse-resize']].map(([h,hx,hy,cur])=>(
                      <rect key={h} x={hx-8} y={hy-8} width={16} height={16}
                        fill="transparent" style={{cursor:cur}}
                        onMouseDown={makeDrag(h)}/>
                    ))}
                  </>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {/* Text placement input */}
      {textPos && drawMode && (
        <div style={{ position:'absolute', left:Math.min(textPos.x,width-250), top:Math.max(4,textPos.y-46),
          zIndex:50, background:'#fff', borderRadius:8, padding:'7px 10px',
          border:`2px solid ${activeColor}`, boxShadow:'0 4px 16px rgba(0,0,0,0.2)',
          display:'flex', gap:6, alignItems:'center',
        }}>
          <input autoFocus type="text" placeholder="Type text…"
            style={{ width:160, fontSize:13, border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', outline:'none' }}
            onKeyDown={e=>{ if(e.key==='Enter') placeText(e.target.value); if(e.key==='Escape') setTextPos(null) }}/>
          <button onClick={e=>placeText(e.currentTarget.previousSibling.value)}
            style={{ background:activeColor, border:'none', color:'#fff', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>✓</button>
          <button onClick={()=>setTextPos(null)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:16 }}>✕</button>
        </div>
      )}

      {/* Label editor for selected shape */}
      {selShape && selShape.type!=='text' && !drawMode && (
        <div style={{
          position:'absolute',
          left: Math.min(Math.max(4,(selShape.x1+selShape.x2)/2-110), width-230),
          top:  Math.max(4, selShape.y1-54),
          zIndex:50, background:'#fff', borderRadius:8, padding:'7px 10px',
          border:`2px solid ${selShape.color}`, boxShadow:'0 4px 18px rgba(0,0,0,0.18)',
          display:'flex', gap:6, alignItems:'center', minWidth:215, pointerEvents:'all',
        }}>
          <input autoFocus type="text" placeholder="Label (ex: ST-123)…"
            value={editLabel}
            onChange={e=>{ setEditLabel(e.target.value); updateLabel(selShape.id, e.target.value) }}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') setSelected(null) }}
            style={{ flex:1, fontSize:12.5, border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', outline:'none' }}/>
          <button onClick={()=>deleteShape(selShape.id)}
            style={{ background:'#c0300e', border:'none', color:'#fff', borderRadius:5, padding:'5px 9px', cursor:'pointer', fontSize:13, fontWeight:700 }}>🗑</button>
          <button onClick={()=>setSelected(null)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:16 }}>✕</button>
        </div>
      )}
    </>
  )
}



// Sidebar panel for annotations
function AnnotSidePanel({ annotGroups, setAnnotGroups, drawShape, setDrawShape, activeColor, setActiveColor, opacity, setOpacity, drawMode, setDrawMode }) {

  return (
    <div style={{ padding:'12px 14px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
        Draw annotations
      </div>
      <div style={{ fontSize:11.5, color:'var(--txt3)', marginBottom:12, lineHeight:1.5, background:'var(--bg2)', padding:'8px 10px', borderRadius:7 }}>
        Click <b>✏ Draw mode</b> in the tree toolbar, then drag to draw shapes. Click a shape to label or delete it.
      </div>

      {/* Draw tool */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:'var(--txt2)', marginBottom:6, fontWeight:600 }}>Tool</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {[['ellipse','⬭ Ellipse'],['rect','▭ Rect'],['text','T Text']].map(([id,label])=>(
            <button key={id} onClick={()=>setDrawShape(id)} style={{
              flex:1, padding:'7px 8px', borderRadius:7, cursor:'pointer', fontSize:12,
              border:`2px solid ${drawShape===id?'var(--accent)':'var(--border)'}`,
              background:drawShape===id?'var(--bg3)':'#fff',
              color:drawShape===id?'var(--accent)':'var(--txt3)',
              fontWeight:drawShape===id?700:400,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:'var(--txt2)', marginBottom:6, fontWeight:600 }}>Color</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          {DRAW_COLORS.map(c=>(
            <button key={c} onClick={()=>setActiveColor(c)} style={{
              width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
              outline: activeColor===c?'3px solid #ffe000':'2px solid #fff',
              boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
            }}/>
          ))}
          <input type="color" value={activeColor} onChange={e=>setActiveColor(e.target.value)}
            style={{ width:24, height:24, borderRadius:'50%', padding:0, border:'none', cursor:'pointer' }}/>
        </div>
      </div>

      {/* Opacity */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--txt2)', fontWeight:600, marginBottom:4 }}>
          <span>Fill opacity</span>
          <span style={{ color:'var(--accent)', fontFamily:'monospace' }}>{Math.round(opacity*100)}%</span>
        </div>
        <input type="range" min={0.04} max={0.65} step={0.01} value={opacity}
          onChange={e=>setOpacity(parseFloat(e.target.value))}
          style={{ width:'100%', accentColor:'var(--accent)' }}/>
      </div>

      {/* Existing annotations list */}
      {annotGroups?.length>0&&(
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Annotations ({annotGroups.length})
          </div>
          {annotGroups.map(s=>(
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 0', borderBottom:'1px solid var(--border2)' }}>
              <div style={{ width:12, height:12, borderRadius:s.type==='rect'?3:'50%', background:s.color, flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:11.5, color:'var(--txt)', fontStyle:s.label?'normal':'italic', color:s.label?'var(--txt)':'var(--txt4)' }}>
                {s.label||'(no label)'}
              </span>
              <button onClick={()=>setAnnotGroups(prev=>prev.filter(a=>a.id!==s.id))}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:13, padding:'0 2px' }}>✕</button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ width:'100%', marginTop:8, fontSize:12 }}
            onClick={()=>setAnnotGroups([])}>Clear all</button>
        </>
      )}
    </div>
  )
}



// Draw legend onto a canvas context (used for PNG export)
function renderLegendOnCanvas(ctx, meta, opts, nodeNames, legendPos) {
  const { metaField, nodeLabelField, leafColor='#1a56db' } = opts || {}
  const field = metaField || nodeLabelField
  if (!field || !meta || !nodeNames.length) return

  const groups = {}
  for (const name of nodeNames) {
    const val = meta[name]?.[field] || '—'
    if (!groups[val]) groups[val] = []
    groups[val].push(name)
  }
  const entries = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]))
  const colors  = d3.schemeTableau10

  const px = legendPos.x, py = legendPos.y
  const rowH = 20, pad = 10
  const w = 190, h = entries.length * rowH + pad * 2 + 28

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.beginPath(); ctx.roundRect?.(px,py,w,h,8) || ctx.rect(px,py,w,h); ctx.fill()
  ctx.strokeStyle = '#c0d0e8'; ctx.lineWidth = 1.5
  ctx.stroke()

  // Header
  ctx.fillStyle = '#eef3ff'
  ctx.beginPath(); ctx.roundRect?.(px,py,w,26,{upperLeft:8,upperRight:8}) || ctx.rect(px,py,w,26); ctx.fill()
  ctx.font = 'bold 10px "IBM Plex Sans",sans-serif'
  ctx.fillStyle = '#1a3faa'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(field.toUpperCase(), px+pad, py+13)

  // Entries
  entries.forEach(([val, nodes], i) => {
    const color = metaField ? colors[i % colors.length] : leafColor
    const ey    = py + 28 + i * rowH + rowH / 2
    ctx.beginPath()
    ctx.arc(px+pad+6, ey, 6, 0, Math.PI*2)
    ctx.fillStyle = color; ctx.fill()
    ctx.font = '11px "IBM Plex Sans",sans-serif'
    ctx.fillStyle = '#0f2460'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(val.length>20?val.slice(0,18)+'…':val, px+pad+16, ey)
    ctx.font = '10px monospace'; ctx.fillStyle = '#93b4f0'
    ctx.textAlign = 'right'
    ctx.fillText(nodes.length, px+w-pad, ey)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  DRAGGABLE LEGEND
// ─────────────────────────────────────────────────────────────────────────────
function TreeLegend({ meta, opts, graph, tree, onClose, pos={x:16,y:16}, setPos }) {
  // pos/setPos from parent so position is preserved across re-renders
  const dragRef = useRef(null)

  const { metaField, nodeLabelField, leafColor='#1a56db' } = opts || {}

  // Get node names from graph or tree
  const nodeNames = useMemo(() => {
    if (graph) return graph.nodes.map(n => n.name)
    if (tree)  return collectLeaves(tree).map(l => l.name)
    return []
  }, [graph, tree])

  // Build legend entries from metaField or nodeLabelField
  const entries = useMemo(() => {
    const field = metaField || nodeLabelField
    if (!field || !meta || !nodeNames.length) return []
    const groups = {}
    for (const name of nodeNames) {
      const val = meta[name]?.[field] || '—'
      if (!groups[val]) groups[val] = []
      groups[val].push(name)
    }
    const colors = d3.schemeTableau10
    return Object.entries(groups)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([val, nodes], i) => ({
        val, nodes,
        color: metaField ? colors[i % colors.length] : leafColor,
      }))
  }, [meta, metaField, nodeLabelField, nodeNames, leafColor])

  const field = metaField || nodeLabelField

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX-pos.x, startY: e.clientY-pos.y }
    const onMove = (e) => {
      if (!dragRef.current) return
      setPos?.({ x: e.clientX-dragRef.current.startX, y: e.clientY-dragRef.current.startY })
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!field || entries.length === 0) return null

  return (
    <div style={{
      position:'absolute', left:pos.x, top:pos.y, zIndex:20,
      background:'rgba(255,255,255,0.96)', borderRadius:10,
      border:'1.5px solid var(--border)', boxShadow:'0 4px 18px rgba(20,50,140,.13)',
      minWidth:180, maxWidth:260, userSelect:'none',
      backdropFilter:'blur(4px)',
    }}>
      {/* Header — drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'7px 10px 6px', cursor:'grab', borderBottom:'1px solid var(--border2)',
          background:'var(--bg2)', borderRadius:'8px 8px 0 0',
        }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--txt2)', textTransform:'uppercase', letterSpacing:'.05em' }}>
          ⋮⋮ {field}
        </span>
        <button onClick={onClose}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt4)', fontSize:15, lineHeight:1, padding:'0 2px' }}>×</button>
      </div>

      {/* Entries */}
      <div style={{ padding:'7px 10px', maxHeight:280, overflowY:'auto' }}>
        {entries.map(({ val, nodes, color }) => (
          <div key={val} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
            <div style={{ width:14, height:14, borderRadius:'50%', background:color, flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
            <span style={{ fontSize:12, color:'var(--txt)', flex:1, lineHeight:1.3 }}>{val}</span>
            <span style={{ fontSize:11, color:'var(--txt4)', fontFamily:'monospace', background:'var(--bg2)', padding:'1px 5px', borderRadius:8 }}>
              {nodes.length}
            </span>
          </div>
        ))}
      </div>

      {/* Footer — field name */}
      <div style={{ padding:'4px 10px 6px', fontSize:10, color:'var(--txt4)', borderTop:'1px solid var(--border2)' }}>
        {nodeNames.length} nodes · drag to move
      </div>
    </div>
  )
}

export function PhyloSidePanel({ treeData, opts, setOpts, meta, setMeta, highlight, setHighlight, annotGroups, setAnnotGroups, drawMode, setDrawMode, drawShape, setDrawShape, drawColor, setDrawColor, drawOpacity, setDrawOpacity, showLegend, setShowLegend }) {
  const [tab, setTab] = useState('display')
  const metaRef = useRef()


  // All hooks before any early return — Rules of Hooks
  const { tree, graph, filename, algo } = treeData || {}
  const stats      = useMemo(() => tree ? treeStats(tree) : null, [tree])
  const metaFields = meta ? Object.keys(Object.values(meta)[0] || {}) : []
  const nNodes     = tree ? collectLeaves(tree).length : graph?.nodes.length

  // Don't return early — always show Display + Groups tabs
  // treeData may be null while tree is still loading

  const handleMeta = async (e) => {
    const file=e.target.files[0]; if(!file) return
    setMeta(parseMetadata(await file.text())); e.target.value=''
  }

  const Slider = ({label,field,min,max,step=1}) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:12, color:'var(--txt2)' }}>{label}</span>
        <span style={{ fontSize:12, fontFamily:'monospace', color:'var(--accent)' }}>{opts[field]}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={opts[field]}
        onChange={e=>setOpts(o=>({...o,[field]:parseFloat(e.target.value)}))}
        style={{ width:'100%', accentColor:'var(--accent)' }}/>
    </div>
  )

  const nodeColors = ['#1a56db','#0e8c9e','#6b40a8','#c0300e','#0a6e40','#cc7000','#333333']
  const lineColors = ['#b8cfef','#aaaaaa','#1a56db','#0a6e40','#333333','#c0300e']

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', borderBottom:'1.5px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        {[['display',<Sliders size={12}/>,'Display'],['annots',<Circle size={12}/>,'Groups'],['info',<Info size={12}/>,'Info']].map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1, padding:'8px 4px', fontSize:12, fontWeight:600,
            color:tab===id?'var(--accent)':'var(--txt3)',
            background:tab===id?'#fff':'transparent',
            border:'none', borderBottom:`2px solid ${tab===id?'var(--accent)':'transparent'}`,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
          }}>{icon} {label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14 }}>
        {tab==='display' && (
          <>
            {/* Legend toggle — top of Display tab */}
            <div style={{ marginBottom:14, padding:'10px 12px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border2)' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12.5, color:'var(--txt2)', fontWeight:600 }}>
                <input type="checkbox"
                  checked={!!showLegend}
                  onChange={e=>setShowLegend?.(e.target.checked)}
                  style={{ accentColor:'var(--accent)', width:15, height:15 }}/>
                Show color legend on tree
              </label>
              {!showLegend && (
                <div style={{ fontSize:11, color:'var(--txt4)', marginTop:5, paddingLeft:23 }}>
                  Load metadata and select a field to display a draggable legend
                </div>
              )}
            </div>

            <Slider label="Node size"       field="nodeSize" min={1}  max={60} step={0.5}/>
            <Slider label="Label font size" field="fontSize" min={6}  max={40} step={0.5}/>
            <Slider label="Branch label size" field="branchFontSize" min={0} max={16} step={0.5}/>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:6 }}>Node color</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {nodeColors.map(c=>(
                  <button key={c} onClick={()=>setOpts(o=>({...o,leafColor:c}))} style={{
                    width:26, height:26, borderRadius:'50%', background:c, cursor:'pointer',
                    border:opts.leafColor===c?'3px solid #ffe000':'2px solid #fff',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
                  }}/>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:6 }}>Branch color</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {lineColors.map(c=>(
                  <button key={c} onClick={()=>setOpts(o=>({...o,lineColor:c}))} style={{
                    width:30, height:8, borderRadius:4, background:c, cursor:'pointer',
                    border:opts.lineColor===c?'2px solid #ffe000':'1px solid #ccc',
                  }}/>
                ))}
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border2)', paddingTop:14, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--txt2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Metadata</div>
              <input ref={metaRef} type="file" accept=".tsv,.csv,.txt" style={{ display:'none' }} onChange={handleMeta}/>
              <button className="btn" style={{ width:'100%', marginBottom:8, justifyContent:'center', fontSize:12 }}
                onClick={()=>metaRef.current.click()}>
                <Upload size={13}/> Load metadata (CSV/TSV)
              </button>
              <div style={{ fontSize:10.5, color:'var(--txt4)', marginBottom:8 }}>First col = sample name, rest = fields</div>
              {metaFields.length>0&&(
                <>
                  <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:5 }}>Color nodes by field</div>
                  <select value={opts.metaField||''} onChange={e=>setOpts(o=>({...o,metaField:e.target.value||null}))}
                    style={{ width:'100%', fontSize:12, marginBottom:8 }}>
                    <option value="">None</option>
                    {metaFields.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:5 }}>Rename nodes from field</div>
                  <select value={opts.nodeLabelField||''} onChange={e=>setOpts(o=>({...o,nodeLabelField:e.target.value||null}))}
                    style={{ width:'100%', fontSize:12 }}>
                    <option value="">— Original names —</option>
                    {metaFields.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize:10, color:'var(--txt4)', marginTop:4 }}>Works in MST/Force mode</div>
                  {opts.metaField&&(
                    <div style={{ marginTop:8 }}>
                      {[...new Set(Object.values(meta).map(m=>m[opts.metaField]).filter(Boolean))].map((v,i)=>(
                        <div key={v} style={{ display:'flex', alignItems:'center', gap:7, padding:'2px 0', fontSize:11 }}>
                          <div style={{ width:12, height:12, borderRadius:3, background:d3.schemeTableau10[i%10], flexShrink:0 }}/>
                          <span style={{ color:'var(--txt2)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ borderTop:'1px solid var(--border2)', paddingTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--txt2)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Highlight</div>
              <input type="text" placeholder="Sample name…" value={highlight||''}
                onChange={e=>setHighlight(e.target.value||null)}
                style={{ width:'100%', fontSize:12 }}/>
              {highlight&&(
                <button className="btn btn-ghost" style={{ width:'100%', marginTop:6, fontSize:12 }}
                  onClick={()=>setHighlight(null)}>
                  <X size={12}/> Clear
                </button>
              )}
            </div>
          </>
        )}

        {tab==='annots' && (
          <>
            <AnnotSidePanel
              annotGroups={annotGroups} setAnnotGroups={setAnnotGroups}
              drawMode={drawMode} setDrawMode={setDrawMode}
              drawShape={drawShape} setDrawShape={setDrawShape}
              activeColor={drawColor} setActiveColor={setDrawColor}
              opacity={drawOpacity} setOpacity={setDrawOpacity}
            />
          </>
        )}
        {tab==='info'&&(
          <>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Tree info</div>
            {[
              ['File', filename||'—'],
              ['Algorithm', algo||'—'],
              ['Type', tree?'Newick tree':'Force graph'],
              ['Leaves / Nodes', nNodes],
              ...(stats?[['Max depth',stats.maxDepth],['Min depth',stats.minDepth]]:[]),
              ...(graph?[['Edges', graph.edges.length]]:[]),
            ].map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid var(--border2)', fontSize:12 }}>
                <span style={{ color:'var(--txt3)' }}>{l}</span>
                <span style={{ fontWeight:600, color:'var(--txt)' }}>{v}</span>
              </div>
            ))}
            {meta&&(
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'.06em', marginTop:16, marginBottom:8 }}>
                  Metadata — {Object.keys(meta).length} samples
                </div>
                {metaFields.map(f=>(
                  <div key={f} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--border2)', fontSize:12 }}>
                    <span style={{ color:'var(--txt3)' }}>{f}</span>
                    <span style={{ color:'var(--txt4)' }}>{[...new Set(Object.values(meta).map(m=>m[f]).filter(Boolean))].length} values</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PhyloTree({ data, onClose, onDataChange, opts: optsProp, setOpts: setOptsProp, meta: metaProp, setMeta: setMetaProp, highlight: highlightProp, setHighlight: setHighlightProp, onAnnotChange, drawMode: drawModeProp, setDrawMode: setDrawModeProp, drawShape: drawShapeProp, setDrawShape: setDrawShapeProp, drawColor: drawColorProp, setDrawColor: setDrawColorProp, drawOpacity: drawOpacityProp, setDrawOpacity: setDrawOpacityProp, showLegend: showLegendProp, setShowLegend: setShowLegendProp }) {
  const containerRef = useRef()
  const [size,       setSize]       = useState({ w:900, h:600 })
  const [mode,       setMode]       = useState(null)
  const [highlightInternal, setHighlightInternal] = useState(null)
  const highlight    = highlightProp    !== undefined ? highlightProp    : highlightInternal
  const setHighlight = setHighlightProp || setHighlightInternal
  const [metaInternal,      setMetaInternal]      = useState(null)
  const meta    = metaProp    !== undefined ? metaProp    : metaInternal
  const setMeta = setMetaProp || setMetaInternal
  const [optsInternal, setOptsInternal] = useState({ nodeSize:7, fontSize:10.5, branchFontSize:8, lineColor:'#b8cfef', leafColor:'#1a56db', metaField:null })
  const [annotGroups,  setAnnotGroups]  = useState([])
  const [showLegendI,  setShowLegendI]  = useState(false)
  const [legendPos,    setLegendPos]    = useState({ x:16, y:16 })
  const showLegend    = showLegendProp  !== undefined ? showLegendProp  : showLegendI
  const setShowLegend = setShowLegendProp || setShowLegendI
  const [drawModeI,    setDrawModeI]    = useState(false)
  const [drawShapeI,   setDrawShapeI]   = useState('ellipse')
  const [drawColorI,   setDrawColorI]   = useState('#1a56db')
  const [drawOpacityI, setDrawOpacityI] = useState(0.18)
  const drawMode    = drawModeProp    !== undefined ? drawModeProp    : drawModeI
  const setDrawMode = setDrawModeProp || setDrawModeI
  const drawShape   = drawShapeProp   || drawShapeI
  const setDrawShape= setDrawShapeProp|| setDrawShapeI
  const drawColor   = drawColorProp   || drawColorI
  const setDrawColor= setDrawColorProp|| setDrawColorI
  const drawOpacity = drawOpacityProp !== undefined ? drawOpacityProp : drawOpacityI
  const setDrawOpacity = setDrawOpacityProp || setDrawOpacityI
  const setAnnotGroupsAndNotify = setAnnotGroups  // plain setter, no setState-in-setState

  // Sync annotations to App via useEffect (safe)
  useEffect(() => { onAnnotChange?.(annotGroups) }, [annotGroups])
  const opts    = optsProp    || optsInternal
  const setOpts = setOptsProp || setOptsInternal
  const [loading,    setLoading]    = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingPct, setLoadingPct] = useState(0)
  const [treeData,   setTreeData]   = useState(data||null)

  const { tree, graph, filename, algo } = treeData||{}

  useEffect(() => {
    if (!treeData) return
    if (treeData.tree && !mode) setMode(treeData.algo==='upgma'||treeData.algo==='nj'?'rect':treeData.algo?.startsWith('mst')?'force':'rect')
    else if (treeData.graph && !mode) setMode('force')
  }, [treeData])

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(([e])=>setSize({ w:Math.floor(e.contentRect.width), h:Math.floor(e.contentRect.height) }))
    ro.observe(el); return ()=>ro.disconnect()
  }, [])

  const handleSelect = async (algoId, file, type) => {
    setLoading(true); setLoadingMsg('Reading file…'); setLoadingPct(10)
    try {
      const text = await file.text()
      if (type==='newick') {
        const t = parseNewick(text)
        if (!t) throw new Error('Could not parse Newick')
        setTreeData({ tree:t, graph:null, filename:file.name, algo:'newick' })
        setMode('rect')
      } else {
        setLoadingMsg('Parsing matrix…'); setLoadingPct(30)
        await new Promise(r=>setTimeout(r,0))
        const dm = parseDistanceMatrix(text)
        setLoadingMsg(`Running ${algoId.toUpperCase()}…`); setLoadingPct(60)
        await new Promise(r=>setTimeout(r,0))

        if (algoId==='nj'||algoId==='upgma') {
          const t = algoId==='nj' ? neighborJoining(dm.labels, dm.matrix) : upgma(dm.labels, dm.matrix)
          const newData = { tree:t, graph:null, filename:file.name, algo:algoId, isAllelic:dm.isAllelic }
          setTreeData(newData)
          onDataChange?.(newData)
          setMode('rect')
        } else {
          let g
          if (algoId==='goeburst') g = goeburst(dm.labels, dm.profiles||dm.matrix)
          else if (algoId==='mst-prim') g = mstPrim(dm.labels, dm.matrix)
          else g = mstKruskal(dm.labels, dm.matrix)
          const newData2 = { tree:null, graph:g, filename:file.name, algo:algoId, isAllelic:dm.isAllelic }
          setTreeData(newData2)
          onDataChange?.(newData2)
          setMode('force')
        }
        setLoadingPct(100)
      }
    } catch (err) {
      alert('Error: '+err.message)
    } finally {
      setLoading(false); setLoadingMsg(''); setLoadingPct(0)
    }
  }

  const handleLeafClick = (name) => setHighlight(h=>h===name?null:name)

  const exportPNG = () => {
    const container = containerRef.current
    const name = (filename?.replace(/\.[^.]+$/,'')||'tree')+'.png'
    if (!container) return

    const canvas  = container.querySelector('canvas')
    // The first SVG is the visual overlay (position:absolute, zIndex:10)
    const allSvgs = Array.from(container.querySelectorAll('svg'))
    const overlays = allSvgs.filter(s=>s.style.position==='absolute')
    const mainSvg  = canvas ? null : allSvgs.find(s=>s.style.position!=='absolute')

    // Merge all SVG overlays into one SVG string for export
    const buildOverlaySVG = (W, H) => {
      const merged = document.createElementNS('http://www.w3.org/2000/svg','svg')
      merged.setAttribute('xmlns','http://www.w3.org/2000/svg')
      merged.setAttribute('width',W); merged.setAttribute('height',H)
      overlays.forEach(svg => {
        if (!svg.querySelectorAll('*').length) return
        const g = document.createElementNS('http://www.w3.org/2000/svg','g')
        Array.from(svg.children).forEach(c=>g.appendChild(c.cloneNode(true)))
        merged.appendChild(g)
      })
      return merged.children.length ? new XMLSerializer().serializeToString(merged) : null
    }

    const drawLegendIfNeeded = (cv, cssW, cssH) => {
      if (!showLegend || !meta) return
      const nodeNames = graph ? graph.nodes.map(n=>n.name) : tree ? collectLeaves(tree).map(l=>l.name) : []
      if (!nodeNames.length) return
      const ctx2 = cv.getContext('2d')
      const scaleX = cv.width / cssW, scaleY = cv.height / cssH
      ctx2.save(); ctx2.scale(scaleX, scaleY)
      renderLegendOnCanvas(ctx2, meta, opts, nodeNames, legendPos)
      ctx2.restore()
    }

    const composite = (baseCanvas, cssW, cssH) => {
      // Output at CSS pixel size (not DPR-scaled) so overlay aligns perfectly
      const out = document.createElement('canvas')
      out.width=cssW; out.height=cssH
      const ctx=out.getContext('2d')
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,cssW,cssH)
      // Draw source canvas scaled down to CSS size
      ctx.drawImage(baseCanvas, 0, 0, cssW, cssH)

      const svgStr = buildOverlaySVG(cssW, cssH)
      if (!svgStr) {
        drawLegendIfNeeded(out, cssW, cssH); const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download=name; a.click()
        return
      }
      const img=new Image()
      const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'}))
      img.onload=()=>{
        ctx.drawImage(img,0,0,cssW,cssH)
        URL.revokeObjectURL(url)
        drawLegendIfNeeded(out, cssW, cssH)  // draw legend
        const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download=name; a.click()
      }
      img.onerror=()=>{ URL.revokeObjectURL(url); const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download=name; a.click() }
      img.src=url
    }

    if (canvas) {
      // canvas.width/height are in physical pixels; clientWidth/Height are CSS pixels
      composite(canvas, canvas.clientWidth||size.w, canvas.clientHeight||canvasH)
    } else if (mainSvg) {
      const W=mainSvg.clientWidth||size.w, H=mainSvg.clientHeight||canvasH
      const cv=document.createElement('canvas'); cv.width=W*2; cv.height=H*2
      const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W*2,H*2)
      const svgStr=new XMLSerializer().serializeToString(mainSvg)
      const img=new Image()
      const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'}))
      img.onload=()=>{
        ctx.drawImage(img,0,0,W*2,H*2); URL.revokeObjectURL(url)
        composite(cv, W, H)
      }
      img.src=url
    }
  }

  const canvasH = Math.max(300, size.h-60)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 14px', background:'#1a3faa', flexShrink:0 }}>
        <GitBranch size={17} color="#a0c0ff"/>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>
          {treeData ? (filename||'Phylogenetic Tree') : 'Phylogenetic Tree Viewer'}
        </span>
        {treeData?.isAllelic && <span style={{ fontSize:11, color:'#a0c0ff', background:'rgba(255,255,255,0.15)', padding:'2px 8px', borderRadius:10 }}>
          chewBBACA · Hamming
        </span>}
        {treeData?.algo && <span style={{ fontSize:11, color:'#ffe000', background:'rgba(255,255,255,0.10)', padding:'2px 8px', borderRadius:10, fontFamily:'monospace' }}>
          {treeData.algo.toUpperCase()}
        </span>}

        <div style={{ flex:1 }}/>

        {treeData && (
          <>
            {/* Draw mode toggle */}
            <button onClick={() => setDrawMode(m => !m)} style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'4px 11px', borderRadius:6, border:'none', cursor:'pointer',
              fontSize:11.5, fontWeight:700,
              background: drawMode ? '#ffe000' : 'rgba(255,255,255,0.15)',
              color:       drawMode ? '#0f2460' : '#c0d8ff',
              transition:'all .15s',
            }} title="Draw mode — drag to draw ellipses/rectangles on the tree">
              ✏ {drawMode ? 'Drawing…' : 'Draw'}
            </button>

            {/* View mode switcher */}
            {tree && (
              <div style={{ display:'flex', gap:4 }}>
                {[['rect','Rectangular',<GitBranch size={12}/>],['circular','Circular',<Circle size={12}/>]].map(([id,label,icon])=>(
                  <button key={id} onClick={()=>setMode(id)} style={{
                    display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6,
                    border:'none', cursor:'pointer', fontSize:11.5, fontWeight:600,
                    background:mode===id?'#ffe000':'rgba(255,255,255,0.15)',
                    color:mode===id?'#0f2460':'#c0d8ff', transition:'all .15s',
                  }}>{icon} {label}</button>
                ))}
              </div>
            )}

            <button className="btn" style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', fontSize:12 }} onClick={exportPNG}>
              <Download size={13}/> PNG
            </button>
            <button className="btn btn-ghost" style={{ color:'#a0c0ff', fontSize:12 }}
              onClick={()=>{ setTreeData(null); setMode(null); setHighlight(null); onDataChange?.(null) }}>
              ← New
            </button>
          </>
        )}
        <button className="btn" style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', fontSize:12 }} onClick={onClose}>
          <X size={13}/> Close
        </button>
      </div>

      {/* Body */}
      <div ref={containerRef} style={{ flex:1, overflow:'auto', background:'#fff', position:'relative' }}>
        {!treeData ? (
          <AlgoSelector onSelect={handleSelect} loading={loading} loadingMsg={loadingMsg} loadingPct={loadingPct}/>
        ) : (
          <div style={{ position:'relative', width:'100%', height:'100%' }}>
            {mode==='rect' && tree && (
              <RectTree root={tree} width={size.w} height={Math.max(canvasH, collectLeaves(tree).length*20+50)}
                highlight={highlight} onLeafClick={handleLeafClick} opts={opts}/>
            )}
            {mode==='circular' && tree && (
              <CircularTree root={tree} width={Math.min(size.w,canvasH+80)} height={Math.min(size.w,canvasH+80)}
                highlight={highlight} onLeafClick={handleLeafClick} opts={opts}/>
            )}
            {mode==='force' && graph && (
              <ForceGraph graph={graph} width={size.w} height={Math.max(canvasH,500)}
                highlight={highlight} onNodeClick={handleLeafClick} meta={meta} opts={opts}/>
            )}
            {/* Draggable legend */}
            {showLegend && (
              <TreeLegend
                meta={meta} opts={opts}
                graph={graph} tree={tree}
                pos={legendPos} setPos={setLegendPos}
                onClose={() => setShowLegend(false)}
              />
            )}

            {/* Drawing overlay — always on top */}
            <DrawOverlay
              width={size.w} height={Math.max(canvasH, mode==='rect'&&tree ? collectLeaves(tree).length*20+50 : 500)}
              shapes={annotGroups} setShapes={setAnnotGroupsAndNotify}
              drawMode={drawMode}
              drawShape={drawShape}
              activeColor={drawColor}
              opacity={drawOpacity}
            />
          </div>
        )}
      </div>
    </div>
  )
}