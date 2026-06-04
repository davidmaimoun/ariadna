// ─────────────────────────────────────────────────────────────────────────────
//  TREE / GRAPH ALGORITHMS
//  NJ, UPGMA, MST (Kruskal), GoeBURST-lite
//  All return { nodes:[{id,name}], edges:[{source,target,weight}] }
//  or a Newick-style root object for tree algorithms
// ─────────────────────────────────────────────────────────────────────────────

// ── Neighbor-Joining (Saitou & Nei 1987) ─────────────────────────────────────
// O(n³), good up to ~2000 taxa
export function neighborJoining(labels, matrix) {
  const n0 = labels.length
  // Work with mutable copy
  let D     = matrix.map(r => [...r])
  let names = [...labels]
  let ids   = labels.map((_, i) => i)
  let idCounter = n0

  // Build node objects (leaves first)
  const nodes = labels.map((l, i) => ({ id: i, name: l, children: [], length: 0 }))
  let active = [...Array(n0).keys()]

  while (active.length > 2) {
    const m = active.length
    // Compute Q matrix
    const r = {}
    for (const i of active) {
      r[i] = active.reduce((s, j) => s + (i !== j ? D[i][j] : 0), 0)
    }

    let minQ = Infinity, pi = -1, pj = -1
    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) {
        const i = active[a], j = active[b]
        const q = (m - 2) * D[i][j] - r[i] - r[j]
        if (q < minQ) { minQ = q; pi = i; pj = j }
      }
    }

    // Branch lengths
    const dij   = D[pi][pj]
    const liLen = dij / 2 + (r[pi] - r[pj]) / (2 * (m - 2))
    const ljLen = dij - liLen

    // New node
    const newId  = idCounter++
    const newNode = { id: newId, name: '', children: [nodes[pi], nodes[pj]], length: 0 }
    nodes[pi].length = Math.max(0, liLen)
    nodes[pj].length = Math.max(0, ljLen)
    nodes[newId]     = newNode

    // Update distance matrix
    D[newId] = {}; D.forEach((_, k) => { if (!D[k]) D[k] = {} })
    for (const k of active) {
      if (k === pi || k === pj) continue
      const d = (D[pi][k] + D[pj][k] - dij) / 2
      D[newId][k] = d; D[k][newId] = d
    }
    D[newId][newId] = 0

    active = active.filter(x => x !== pi && x !== pj)
    active.push(newId)
  }

  // Join last two
  if (active.length === 2) {
    const [a, b] = active
    const root   = { id: idCounter++, name: 'root', children: [nodes[a], nodes[b]], length: 0 }
    nodes[a].length = D[a]?.[b] ? D[a][b] / 2 : 0.01
    nodes[b].length = nodes[a].length
    return root
  }
  return nodes[active[0]]
}

// ── UPGMA ─────────────────────────────────────────────────────────────────────
export function upgma(labels, matrix) {
  const n0   = labels.length
  let D       = matrix.map(r => [...r])
  let sizes   = new Array(n0).fill(1)
  const nodes = labels.map((l, i) => ({ id: i, name: l, children: [], length: 0, _height: 0 }))
  let active  = [...Array(n0).keys()]
  let idC     = n0

  while (active.length > 1) {
    let minD = Infinity, pi = -1, pj = -1
    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) {
        const i = active[a], j = active[b]
        if (D[i][j] < minD) { minD = D[i][j]; pi = i; pj = j }
      }
    }

    const h    = minD / 2
    const ni   = { id: idC++, name: '', children: [nodes[pi], nodes[pj]], length: 0, _height: h }
    nodes[pi].length = Math.max(0, h - nodes[pi]._height)
    nodes[pj].length = Math.max(0, h - nodes[pj]._height)
    nodes[ni.id]     = ni

    const si = sizes[pi], sj = sizes[pj]
    D[ni.id] = {}
    for (const k of active) {
      if (k === pi || k === pj) continue
      D[ni.id][k] = (D[pi][k] * si + D[pj][k] * sj) / (si + sj)
      D[k][ni.id] = D[ni.id][k]
    }
    D[ni.id][ni.id] = 0
    sizes[ni.id]    = si + sj

    active = active.filter(x => x !== pi && x !== pj)
    active.push(ni.id)
  }
  return nodes[active[0]]
}

// ── MST — Kruskal ─────────────────────────────────────────────────────────────
export function mstKruskal(labels, matrix) {
  const n = labels.length
  // Build edge list
  const edges = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      edges.push({ i, j, w: matrix[i][j] })
  edges.sort((a, b) => a.w - b.w)

  // Union-Find
  const parent = [...Array(n).keys()]
  const rank   = new Array(n).fill(0)
  function find(x) { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x] }
  function union(x, y) {
    const px = find(x), py = find(y)
    if (px === py) return false
    if (rank[px] < rank[py]) parent[px] = py
    else if (rank[px] > rank[py]) parent[py] = px
    else { parent[py] = px; rank[px]++ }
    return true
  }

  const mstEdges = []
  for (const { i, j, w } of edges) {
    if (union(i, j)) mstEdges.push({ source: i, target: j, weight: w })
    if (mstEdges.length === n - 1) break
  }
  return { nodes: labels.map((l, i) => ({ id: i, name: l })), edges: mstEdges }
}

// ── MST — Prim (original, kept for compatibility) ─────────────────────────────
export function mstPrim(labels, matrix) {
  const n       = labels.length
  const inTree  = new Array(n).fill(false)
  const minDist = new Array(n).fill(Infinity)
  const parent  = new Array(n).fill(-1)
  minDist[0]    = 0
  for (let iter = 0; iter < n; iter++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || minDist[i] < minDist[u])) u = i
    if (u === -1) break
    inTree[u] = true
    for (let v = 0; v < n; v++) {
      const d = matrix[u]?.[v] ?? Infinity
      if (!inTree[v] && d < minDist[v]) { minDist[v] = d; parent[v] = u }
    }
  }
  const edges = []
  for (let i = 1; i < n; i++) if (parent[i] !== -1) edges.push({ source: parent[i], target: i, weight: minDist[i] })
  return { nodes: labels.map((l, i) => ({ id: i, name: l })), edges }
}

// ── GoeBURST-lite ─────────────────────────────────────────────────────────────
// Simplified: group STs by single-locus variants (SLV), then double (DLV), etc.
// Returns MST-compatible structure with priority-based edge selection
export function goeburst(labels, profiles) {
  const n = labels.length
  // Compute allelic distance
  function allelicDist(i, j) {
    let d = 0
    const len = profiles[0].length
    for (let k = 0; k < len; k++) {
      const a = profiles[i][k], b = profiles[j][k]
      const am = !a || a === '0' || isNaN(Number(a))
      const bm = !b || b === '0' || isNaN(Number(b))
      if (!am && !bm && a !== b) d++
    }
    return d
  }

  // Count SLVs for each node (higher = more "founder-like")
  const slvCount = new Array(n).fill(0)
  const dlvCount = new Array(n).fill(0)
  const distMatrix = []
  for (let i = 0; i < n; i++) {
    distMatrix.push([])
    for (let j = 0; j < n; j++) {
      const d = i === j ? 0 : allelicDist(i, j)
      distMatrix[i].push(d)
      if (d === 1) { slvCount[i]++; if (i < j) slvCount[j]++ }
      if (d === 2) { dlvCount[i]++; if (i < j) dlvCount[j]++ }
    }
  }

  // GoeBURST priority: prefer edges between nodes with more SLVs
  // Build edges with priority score
  const edgesAll = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edgesAll.push({
        i, j,
        dist: distMatrix[i][j],
        // tie-breaking: prefer SLV > DLV > higher founder count
        priority: distMatrix[i][j] * 10000 - (slvCount[i] + slvCount[j]),
      })
    }
  }
  edgesAll.sort((a, b) => a.priority - b.priority)

  // Kruskal with GoeBURST priority
  const parent = [...Array(n).keys()]
  const rank   = new Array(n).fill(0)
  function find(x) { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x] }
  function union(x, y) {
    const px = find(x), py = find(y)
    if (px === py) return false
    if (rank[px] < rank[py]) parent[px] = py
    else if (rank[px] > rank[py]) parent[py] = px
    else { parent[py] = px; rank[px]++ }
    return true
  }

  const mstEdges = []
  for (const { i, j, dist } of edgesAll) {
    if (union(i, j)) mstEdges.push({ source: i, target: j, weight: dist })
    if (mstEdges.length === n - 1) break
  }

  return {
    nodes: labels.map((l, i) => ({ id: i, name: l, slv: slvCount[i], dlv: dlvCount[i] })),
    edges: mstEdges,
  }
}

// ── Worker-friendly wrapper ───────────────────────────────────────────────────
// Returns { nodes, edges } for graph algorithms, root for tree algorithms
export function runAlgorithm(algo, labels, matrix, profiles) {
  switch (algo) {
    case 'mst-kruskal': return { graph: mstKruskal(labels, matrix) }
    case 'mst-prim':    return { graph: mstPrim(labels, matrix) }
    case 'goeburst':    return { graph: goeburst(labels, profiles || matrix.map((_, i) => matrix[i])) }
    case 'nj':          return { tree: neighborJoining(labels, matrix) }
    case 'upgma':       return { tree: upgma(labels, matrix) }
    default:            return { graph: mstKruskal(labels, matrix) }
  }
}
