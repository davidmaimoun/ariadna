// Web Worker: off-main-thread sequence parser
// Handles FASTA, FASTQ, GenBank formats with chunked streaming

const CHUNK_SIZE = 64 * 1024 // 64KB

self.onmessage = async (e) => {
  const { type, payload } = e.data
  if (type === 'PARSE_FILE') await parseFile(payload.file)
  if (type === 'GET_REGION') getRegion(payload)
}

let fullSequence = null
let sequenceIndex = [] // [{chunk, offset, seqOffset}] every 1000bp

async function parseFile(file) {
  const start = performance.now()
  const size = file.size
  let offset = 0
  let seqBuffer = ''
  let header = null
  let description = ''
  let format = 'unknown'
  let totalSeqLen = 0
  let qualBuffer = ''
  let inQual = false
  let inSeq = false
  let gbFeatures = []
  let gbMode = 'header'

  self.postMessage({ type: 'PROGRESS', payload: { progress: 0, message: 'Reading file…' } })

  // Detect format from first chunk
  const firstChunk = await readChunk(file, 0, Math.min(1024, size))
  const firstText = new TextDecoder().decode(firstChunk)
  if (firstText.startsWith('>')) format = 'fasta'
  else if (firstText.startsWith('@')) format = 'fastq'
  else if (firstText.startsWith('LOCUS')) format = 'genbank'
  else format = 'fasta' // fallback

  const decoder = new TextDecoder()
  let lineBuffer = ''

  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size)
    const chunk = await readChunk(file, offset, end)
    const text = lineBuffer + decoder.decode(chunk, { stream: true })
    const lines = text.split('\n')
    lineBuffer = lines.pop() // save incomplete last line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (format === 'fasta') {
        if (trimmed.startsWith('>')) {
          const parts = trimmed.slice(1).split(/\s+/)
          header = parts[0]
          description = trimmed.slice(1)
          inSeq = true
        } else if (inSeq) {
          const clean = trimmed.toUpperCase().replace(/[^ACGTUNRYWSKMBDHV\-\.]/g, 'N')
          // Index every 1000bp
          for (let i = 0; i < clean.length; i++) {
            if ((totalSeqLen + i) % 1000 === 0) {
              sequenceIndex.push({ seqOffset: totalSeqLen + i, fileOffset: offset + i })
            }
          }
          seqBuffer += clean
          totalSeqLen += clean.length
        }
      } else if (format === 'fastq') {
        if (trimmed.startsWith('@') && !inQual) {
          header = trimmed.slice(1).split(/\s+/)[0]
          description = trimmed.slice(1)
          inSeq = true; inQual = false
        } else if (inSeq && !trimmed.startsWith('+')) {
          const clean = trimmed.toUpperCase()
          seqBuffer += clean
          totalSeqLen += clean.length
          inSeq = false
        } else if (trimmed.startsWith('+')) {
          inQual = true; inSeq = false
        } else if (inQual) {
          qualBuffer += trimmed
          if (qualBuffer.length >= seqBuffer.length) inQual = false
        }
      } else if (format === 'genbank') {
        parseGenBankLine(trimmed, { gbMode, gbFeatures, seqBuffer }, (updates) => {
          if (updates.seq) { seqBuffer += updates.seq; totalSeqLen += updates.seq.length }
          if (updates.mode) gbMode = updates.mode
          if (updates.feature) gbFeatures.push(updates.feature)
          if (updates.header) { header = updates.header; description = updates.description || '' }
        })
      }
    }

    offset = end
    const progress = Math.round((offset / size) * 100)
    if (progress % 5 === 0) {
      self.postMessage({ type: 'PROGRESS', payload: { progress, message: `Parsing… ${formatSize(offset)} / ${formatSize(size)}` } })
    }
  }

  // Handle last line
  if (lineBuffer.trim() && format === 'fasta') {
    const clean = lineBuffer.trim().toUpperCase().replace(/[^ACGTUNRYWSKMBDHV\-\.]/g, 'N')
    seqBuffer += clean
    totalSeqLen += clean.length
  }

  fullSequence = seqBuffer

  const elapsed = ((performance.now() - start) / 1000).toFixed(2)
  const type_ = detectSequenceType(seqBuffer.slice(0, 1000))

  self.postMessage({
    type: 'DONE',
    payload: {
      meta: {
        id: header || file.name.replace(/\.[^.]+$/, ''),
        description,
        length: totalSeqLen,
        type: type_,
        format,
        gcContent: calcGC(seqBuffer.slice(0, 100000)),
        parseTime: elapsed,
        fileSize: size,
      },
      sequence: seqBuffer.length <= 10_000_000 ? seqBuffer : seqBuffer.slice(0, 10_000_000),
      sequenceTruncated: seqBuffer.length > 10_000_000,
      sequenceIndex,
      annotations: gbFeatures,
    }
  })
}

function parseGenBankLine(line, state, cb) {
  if (line.startsWith('LOCUS')) {
    const parts = line.split(/\s+/)
    cb({ header: parts[1], description: line })
  } else if (line.startsWith('DEFINITION')) {
    cb({ description: line.replace('DEFINITION', '').trim() })
  } else if (line.startsWith('FEATURES')) {
    cb({ mode: 'features' })
  } else if (line.startsWith('ORIGIN')) {
    cb({ mode: 'sequence' })
  } else if (state.gbMode === 'sequence') {
    const seqOnly = line.replace(/[\d\s]/g, '').toUpperCase()
    if (seqOnly) cb({ seq: seqOnly })
  } else if (state.gbMode === 'features' && line && !line.startsWith(' ')) {
    // skip
  } else if (state.gbMode === 'features') {
    const featureMatch = line.match(/^\s{5}(\w+)\s+(.+)$/)
    if (featureMatch) {
      const [, ftype, loc] = featureMatch
      const ranges = parseLocation(loc)
      if (ranges && ftype !== 'source') {
        state.currentFeature = { type: ftype, start: ranges[0], end: ranges[1], strand: ranges[2], qualifiers: {} }
        cb({ feature: state.currentFeature })
      }
    } else if (state.currentFeature) {
      const qMatch = line.match(/^\s+\/(\w+)="?([^"]*)"?/)
      if (qMatch) state.currentFeature.qualifiers[qMatch[1]] = qMatch[2]
    }
  }
}

function parseLocation(loc) {
  const comp = loc.startsWith('complement(')
  const clean = loc.replace('complement(', '').replace('join(', '').replace(')', '')
  const parts = clean.split(',')[0]
  const match = parts.match(/(\d+)\.\.(\d+)/)
  if (match) return [parseInt(match[1]) - 1, parseInt(match[2]) - 1, comp ? -1 : 1]
  const single = parts.match(/(\d+)/)
  if (single) { const p = parseInt(single[1]) - 1; return [p, p, comp ? -1 : 1] }
  return null
}

function getRegion({ start, end }) {
  if (!fullSequence) return
  const region = fullSequence.slice(start, end)
  self.postMessage({ type: 'REGION', payload: { start, end, sequence: region } })
}

function detectSequenceType(seq) {
  const upper = seq.toUpperCase().slice(0, 500)
  const hasU = /U/.test(upper)
  const hasProtein = /[EFILPQZ]/.test(upper)
  if (hasProtein) return 'protein'
  if (hasU) return 'RNA'
  return 'DNA'
}

function calcGC(seq) {
  const upper = seq.toUpperCase()
  const gc = (upper.match(/[GC]/g) || []).length
  return seq.length ? ((gc / seq.length) * 100).toFixed(1) : 0
}

function readChunk(file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file.slice(start, end))
  })
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + 'GB'
}
