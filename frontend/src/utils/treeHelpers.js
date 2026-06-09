// Shared tree utility functions — used by PhyloTree sub-components

export function parseMetadata(text) {
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

export function collectLeaves(node) {
  if (!node.children?.length) return [node]
  return node.children.flatMap(collectLeaves)
}

export function computeDepths(node, d = 0) {
  node._depth = d
  for (const c of (node.children || [])) computeDepths(c, d + (c.length || 0.01))
}

// Topological height: longest path (in node steps) from this node down to a leaf.
function nodeHeight(n) {
  if (!n.children?.length) return 0
  return 1 + Math.max(...n.children.map(nodeHeight))
}

export function assignRectCoords(root, W, H, alignTips = false, cladogram = false) {
  computeDepths(root, 0)
  const leaves = collectLeaves(root)
  const rowH   = H / leaves.length
  leaves.forEach((l, i) => { l._y = (i + 0.5) * rowH })

  if (cladogram) {
    // Place nodes by topological level so all leaves land on the same vertical.
    const totalH = nodeHeight(root) || 1
    const place = (n, level) => {
      // x grows left→right; leaves (height 0) sit at the far right (level === totalH)
      n._x = (level / totalH) * W
      n._parentX = level > 0 ? ((level - 1) / totalH) * W : 0
      if (!n.children?.length) { n._tipX = W; return }
      n.children.forEach(c => place(c, level + 1))
      n._y = (n.children[0]._y + n.children[n.children.length - 1]._y) / 2
    }
    place(root, 0)
    return
  }

  const maxD   = Math.max(...leaves.map(l => l._depth), 1)
  function lay(n, parentX) {
    n._x       = (n._depth / maxD) * W
    n._parentX = parentX
    if (!n.children?.length) {
      n._tipX = alignTips ? W : n._x
      return
    }
    n.children.forEach(c => lay(c, n._x))
    n._y = (n.children[0]._y + n.children[n.children.length - 1]._y) / 2
  }
  lay(root, 0)
}

export function assignCircularCoords(root, R) {
  computeDepths(root, 0)
  const leaves = collectLeaves(root)
  const step   = (2 * Math.PI) / leaves.length
  const maxD   = Math.max(...leaves.map(l => l._depth), 1)
  leaves.forEach((l, i) => { l._angle = i * step - Math.PI / 2 })
  function lay(n) {
    const r = (n._depth / maxD) * R
    if (!n.children?.length) { n._x = r * Math.cos(n._angle); n._y = r * Math.sin(n._angle); return }
    n.children.forEach(lay)
    const angs = collectLeaves(n).map(l => l._angle)
    n._angle   = (Math.min(...angs) + Math.max(...angs)) / 2
    n._x = r * Math.cos(n._angle); n._y = r * Math.sin(n._angle)
  }
  lay(root)
}

export function treeStats(root) {
  const cl = JSON.parse(JSON.stringify(root))
  computeDepths(cl)
  const lv = collectLeaves(cl)
  const dp = lv.map(l => l._depth)
  return {
    leaves:   lv.length,
    maxDepth: Math.max(...dp).toFixed(5),
    minDepth: Math.min(...dp).toFixed(5),
  }
}