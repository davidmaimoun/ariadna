// GFF3 / BED / GTF parser

export function parseGFF3(text) {
  const features = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 8) continue
    const [seqid, source, type, start, end, score, strand, phase, attrs] = cols
    const qualifiers = {}
    if (attrs) {
      for (const attr of attrs.split(';')) {
        const [k, v] = attr.trim().split('=')
        if (k && v) qualifiers[k] = decodeURIComponent(v)
      }
    }
    features.push({
      id: qualifiers.ID || `feat_${features.length}`,
      type,
      seqid,
      source,
      start: parseInt(start) - 1,
      end: parseInt(end) - 1,
      strand: strand === '-' ? -1 : 1,
      score: score === '.' ? null : parseFloat(score),
      phase: phase === '.' ? null : parseInt(phase),
      qualifiers,
      color: getFeatureColor(type),
    })
  }
  return features
}

export function parseBED(text) {
  const features = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('track') || line.startsWith('browser') || !line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 3) continue
    const [chrom, chromStart, chromEnd, name, score, strand] = cols
    features.push({
      id: name || `bed_${features.length}`,
      type: 'region',
      seqid: chrom,
      start: parseInt(chromStart),
      end: parseInt(chromEnd) - 1,
      strand: strand === '-' ? -1 : 1,
      score: score ? parseFloat(score) : null,
      qualifiers: { Name: name || '' },
      color: '#58a6ff',
    })
  }
  return features
}

export function parseGTF(text) {
  const features = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 8) continue
    const [seqid, source, type, start, end, score, strand, frame, attrs] = cols
    const qualifiers = {}
    if (attrs) {
      const matches = attrs.matchAll(/(\w+)\s+"([^"]+)"/g)
      for (const m of matches) qualifiers[m[1]] = m[2]
    }
    features.push({
      id: qualifiers.gene_id || qualifiers.transcript_id || `gtf_${features.length}`,
      type,
      seqid,
      source,
      start: parseInt(start) - 1,
      end: parseInt(end) - 1,
      strand: strand === '-' ? -1 : 1,
      qualifiers,
      color: getFeatureColor(type),
    })
  }
  return features
}

export function getFeatureColor(type) {
  const colors = {
    gene: '#3fb950',
    mRNA: '#58a6ff',
    CDS: '#f78166',
    exon: '#e3b341',
    intron: '#484f58',
    UTR: '#bc8cff',
    five_prime_UTR: '#bc8cff',
    three_prime_UTR: '#b392f0',
    ncRNA: '#39d353',
    rRNA: '#4ac26b',
    tRNA: '#56d364',
    misc_feature: '#8b949e',
    repeat_region: '#6e7681',
    regulatory: '#ffa657',
    promoter: '#ff9a1f',
    terminator: '#da3633',
    region: '#58a6ff',
  }
  return colors[type] || '#8b949e'
}

export function detectAnnotationFormat(text) {
  const first = text.slice(0, 2000)
  if (first.includes('##gff-version 3') || first.includes('\t.\t') && first.split('\t').length >= 9) return 'gff3'
  if (/^track\s/m.test(first) || first.split('\t').length <= 6) return 'bed'
  return 'gtf'
}

export function parseAnnotationFile(text, filename) {
  const fmt = detectAnnotationFormat(text)
  if (fmt === 'gff3') return parseGFF3(text)
  if (fmt === 'bed') return parseBED(text)
  return parseGTF(text)
}

// Complement / reverse complement
export function complement(seq) {
  const map = { A:'T', T:'A', G:'C', C:'G', U:'A', N:'N', '-':'-', '.':'.' }
  return seq.split('').map(c => map[c.toUpperCase()] || 'N').join('')
}

export function reverseComplement(seq) {
  return complement(seq).split('').reverse().join('')
}

// Translation
const CODON_TABLE = {
  'TTT':'F','TTC':'F','TTA':'L','TTG':'L',
  'CTT':'L','CTC':'L','CTA':'L','CTG':'L',
  'ATT':'I','ATC':'I','ATA':'I','ATG':'M',
  'GTT':'V','GTC':'V','GTA':'V','GTG':'V',
  'TCT':'S','TCC':'S','TCA':'S','TCG':'S',
  'CCT':'P','CCC':'P','CCA':'P','CCG':'P',
  'ACT':'T','ACC':'T','ACA':'T','ACG':'T',
  'GCT':'A','GCC':'A','GCA':'A','GCG':'A',
  'TAT':'Y','TAC':'Y','TAA':'*','TAG':'*',
  'CAT':'H','CAC':'H','CAA':'Q','CAG':'Q',
  'AAT':'N','AAC':'N','AAA':'K','AAG':'K',
  'GAT':'D','GAC':'D','GAA':'E','GAG':'E',
  'TGT':'C','TGC':'C','TGA':'*','TGG':'W',
  'CGT':'R','CGC':'R','CGA':'R','CGG':'R',
  'AGT':'S','AGC':'S','AGA':'R','AGG':'R',
  'GGT':'G','GGC':'G','GGA':'G','GGG':'G',
}

export function translate(seq, frame = 0) {
  const s = seq.toUpperCase().slice(frame)
  let protein = ''
  for (let i = 0; i + 2 < s.length; i += 3) {
    const codon = s.slice(i, i + 3)
    protein += CODON_TABLE[codon] || 'X'
  }
  return protein
}

export function calcGCContent(seq) {
  const upper = seq.toUpperCase()
  const gc = (upper.match(/[GC]/g) || []).length
  return seq.length ? (gc / seq.length) * 100 : 0
}

export function findORFs(seq, minLength = 100) {
  const orfs = []
  const upper = seq.toUpperCase()
  for (let frame = 0; frame < 3; frame++) {
    let start = null
    for (let i = frame; i + 2 < upper.length; i += 3) {
      const codon = upper.slice(i, i + 3)
      if (codon === 'ATG' && start === null) start = i
      if ((codon === 'TAA' || codon === 'TAG' || codon === 'TGA') && start !== null) {
        if (i - start >= minLength) {
          orfs.push({ start, end: i + 2, frame, strand: 1, length: i - start + 3 })
        }
        start = null
      }
    }
  }
  const rc = reverseComplement(upper)
  for (let frame = 0; frame < 3; frame++) {
    let start = null
    for (let i = frame; i + 2 < rc.length; i += 3) {
      const codon = rc.slice(i, i + 3)
      if (codon === 'ATG' && start === null) start = i
      if ((codon === 'TAA' || codon === 'TAG' || codon === 'TGA') && start !== null) {
        if (i - start >= minLength) {
          const rStart = upper.length - (i + 3)
          const rEnd = upper.length - start - 1
          orfs.push({ start: rStart, end: rEnd, frame: frame + 3, strand: -1, length: i - start + 3 })
        }
        start = null
      }
    }
  }
  return orfs.sort((a, b) => a.start - b.start)
}

export function exportFASTA(meta, sequence) {
  const id = meta?.id || 'sequence'
  const desc = meta?.description || ''
  const header = `>${id}${desc && desc !== id ? ' ' + desc : ''}`
  const lines = []
  for (let i = 0; i < sequence.length; i += 60) lines.push(sequence.slice(i, i + 60))
  return header + '\n' + lines.join('\n')
}

export function exportGFF3(annotations, seqid) {
  const lines = ['##gff-version 3']
  for (const f of annotations) {
    const attrs = Object.entries(f.qualifiers || {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join(';')
    lines.push([
      seqid || f.seqid || '.',
      f.source || 'BioViewer',
      f.type,
      f.start + 1,
      f.end + 1,
      f.score ?? '.',
      f.strand === -1 ? '-' : '+',
      f.phase ?? '.',
      attrs || `ID=${f.id}`
    ].join('\t'))
  }
  return lines.join('\n')
}
