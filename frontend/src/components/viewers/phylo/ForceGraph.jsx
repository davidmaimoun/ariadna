import { useRef, useEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'

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

export default function ForceGraph({ graph, width, height, highlight, onNodeClick, meta, opts, annotGroups=[] }) {
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

