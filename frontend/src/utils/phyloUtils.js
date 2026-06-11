// Phylogenetic utility functions — shared between PhyloTree component and App.jsx
import { mstKruskal, mstPrim, goeburst, neighborJoining, upgma } from './treeAlgorithms'

export function parseNewick(str) {
  const s = str.trim().replace(/\r/g, '').replace(/\s+/g, ' ').trim()
  let pos = 0, idC = 0
  function parseNode() {
    const node = { id: idC++, name: '', length: 0, children: [], support: null }
    if (s[pos] === '(') {
      pos++
      node.children.push(parseNode())
      while (pos < s.length && s[pos] === ',') { pos++; node.children.push(parseNode()) }
      if (pos < s.length && s[pos] === ')') pos++
      const sup = s.slice(pos).match(/^([0-9]+(?:\.[0-9]*)?)(?=[:,);])/)
      if (sup) { node.support = parseFloat(sup[1]); pos += sup[1].length }
    }
    const nm = s.slice(pos).match(/^([^,:;()\s][^,:;()]*)/)
    if (nm) { node.name = nm[1].trim(); pos += nm[1].length }
    if (pos < s.length && s[pos] === ':') {
      pos++
      const ln = s.slice(pos).match(/^[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/)
      if (ln) { node.length = parseFloat(ln[0]); pos += ln[0].length }
    }
    return node
  }
  try { return parseNode() } catch (e) { console.error('Newick parse error:', e); return null }
}

export function parseDistanceMatrix(text) {
  const lines = text.trim().split(/\r\n|\r|\n/).filter(l => l.trim() && !l.startsWith('#'))
  if (lines.length < 2) throw new Error('This file has fewer than 2 usable lines. A distance/profile matrix needs a header row plus at least one sample row. If this is a Newick tree, use "Load Newick" instead.')
  const sep       = lines[0].includes('\t') ? '\t' : ','
  const firstCell = lines[0].split(sep)[0].trim().toUpperCase()
  const isAllelic = firstCell === 'FILE' || firstCell === '' ||
    (/^[A-Z]{2,}/.test(firstCell) && isNaN(parseFloat(lines[0].split(sep)[1])))
  const dataLines = lines.slice(1).filter(l => l.trim())
  const labels    = dataLines.map(l => l.split(sep)[0].trim())
  const n         = labels.length
  if (n === 0) throw new Error('No sample rows found')
  let distMatrix, profiles
  if (isAllelic) {
    profiles = dataLines.map(l => l.split(sep).slice(1).map(v => v.trim()))
    const nL = profiles[0].length
    distMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let diff = 0
        for (let k = 0; k < nL; k++) {
          const a = profiles[i][k], b = profiles[j][k]
          if (a && b && a !== '0' && b !== '0' && !isNaN(Number(a)) && !isNaN(Number(b)) && a !== b) diff++
        }
        distMatrix[i][j] = diff; distMatrix[j][i] = diff
      }
    }
  } else {
    distMatrix = dataLines.map(l => {
      const cols = l.split(sep).slice(1)
      return cols.map(v => { const x = parseFloat(v.trim()); return isNaN(x) ? 0 : x })
    })
    for (let i = 0; i < n; i++) {
      while (distMatrix[i].length < n) distMatrix[i].push(0)
      distMatrix[i] = distMatrix[i].slice(0, n)
    }
  }
  return { labels, matrix: distMatrix, isAllelic, profiles }
}

export function buildMST(labels, matrix) { return mstKruskal(labels, matrix) }

// ──────────────────────────────────────────────────────────────────────────
// Collapse a graph (MST/GoeBURST) by merging nodes joined by an edge whose
// weight (distance) is below `threshold`. Returns a new {nodes, edges} where
// merged nodes carry `members` (original names) and `count`. Between-group
// edges keep the minimum crossing weight; internal edges are dropped.
// This powers the "group close nodes into a pie" view (à la GrapeTree).
export function collapseByThreshold(graph, threshold) {
  if (!graph || !threshold || threshold <= 0) return graph

  const parent = {}
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }

  graph.nodes.forEach((n) => { parent[n.id] = n.id })
  graph.edges.forEach((e) => { if (e.weight < threshold) union(e.source, e.target) })

  // group original nodes by their representative root
  const groups = {}
  graph.nodes.forEach((n) => { const r = find(n.id); (groups[r] = groups[r] || []).push(n) })

  const idMap = {}   // originalId -> groupRoot
  const newNodes = Object.entries(groups).map(([root, members]) => {
    members.forEach((m) => { idMap[m.id] = root })
    const rep = members[0]
    return {
      id: root,
      name: members.length > 1 ? `${rep.name} +${members.length - 1}` : rep.name,
      members: members.map((m) => m.name),
      count: members.length,
    }
  })

  // collapse edges between groups, keep the smallest crossing weight
  const emap = {}
  graph.edges.forEach((e) => {
    const a = idMap[e.source], b = idMap[e.target]
    if (a === b) return
    const key = a < b ? a + '|' + b : b + '|' + a
    if (!emap[key] || e.weight < emap[key].weight) emap[key] = { source: a, target: b, weight: e.weight }
  })

  return { nodes: newNodes, edges: Object.values(emap) }
}