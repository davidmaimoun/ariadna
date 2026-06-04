import { useRef } from 'react'
import { Dna, BarChart2, AlignLeft, FlaskConical, Microscope,
         Grid3x3, GitBranch, FolderOpen, ArrowLeft } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL PICKER
//  Shows when user clicks a category button in TopBar.
//  Category → cards → file input → dispatch event
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'sequence',
    icon: <Dna size={36}/>,
    label: 'Sequence',
    desc: 'FASTA, GenBank, FASTQ, VCF, SAM/BAM, BLAST',
    color: '#1a56db',
    bg: '#f0f5ff',
  },
  {
    id: 'sanger',
    icon: <Microscope size={36}/>,
    label: 'Sanger',
    desc: 'AB1 trace files, electropherogram viewer',
    color: '#0a6e40',
    bg: '#f0faf5',
  },
  {
    id: 'matrix',
    icon: <Grid3x3 size={36}/>,
    label: 'Matrix',
    desc: 'Heatmap, distance matrix, allelic profiles',
    color: '#cc7000',
    bg: '#fffaf0',
  },
  {
    id: 'tree',
    icon: <GitBranch size={36}/>,
    label: 'Tree',
    desc: 'NJ, UPGMA, MST, GoeBURST, Newick import',
    color: '#6b40a8',
    bg: '#f8f0ff',
  },
]

const SEQUENCE_TOOLS = [
  {
    id: 'fasta',
    icon: <Dna size={28}/>,
    label: 'FASTA / GenBank',
    desc: 'Nucleotide or protein sequence viewer with annotations',
    accepts: '.fa,.fasta,.fna,.fastq,.fq,.gb,.gbk,.genbank,.afa,.aln',
    color: '#1a56db',
    event: 'bv:openfasta',
  },
  {
    id: 'vcf',
    icon: <BarChart2 size={28}/>,
    label: 'VCF — Variants',
    desc: 'Variant Call Format — SNPs, INDELs, structural variants',
    accepts: '.vcf,.vcf.gz',
    color: '#0e8c9e',
    event: 'bv:openvcf',
  },
  {
    id: 'bam',
    icon: <AlignLeft size={28}/>,
    label: 'SAM / BAM',
    desc: 'Alignment file — read pileup and coverage track',
    accepts: '.sam,.bam',
    color: '#c0300e',
    event: 'bv:openbam',
  },
  {
    id: 'blast',
    icon: <FlaskConical size={28}/>,
    label: 'BLAST Results',
    desc: 'XML, tabular or JSON BLAST output — hit diagram',
    accepts: '.xml,.txt,.tsv,.tab,.json,.out',
    color: '#6b40a8',
    event: 'bv:openblast',
  },
]

const SANGER_TOOLS = [
  {
    id: 'ab1',
    icon: <Microscope size={28}/>,
    label: 'AB1 Trace File',
    desc: 'Applied Biosystems AB1 — 4-channel electropherogram, quality scores, base editing',
    accepts: '.ab1',
    color: '#0a6e40',
    event: 'bv:opensangerfile',
  },
]

const MATRIX_TOOLS = [
  {
    id: 'matrix',
    icon: <Grid3x3 size={28}/>,
    label: 'Distance / Allelic Matrix',
    desc: 'Pre-computed distance matrix or chewBBACA/wgMLST allelic profile — heatmap, table, presence/absence views',
    accepts: '.tsv,.csv,.txt,.tab',
    color: '#cc7000',
    event: 'bv:openmatrix',
  },
]

function ToolCard({ tool, onPick }) {
  const ref = useRef()
  return (
    <>
      <input ref={ref} type="file" accept={tool.accepts} style={{ display:'none' }}
        onChange={e => {
          const f = e.target.files[0]
          if (f) {
            if (tool.event === 'bv:opensangerfile') {
              f.arrayBuffer().then(buf =>
                window.dispatchEvent(new CustomEvent('bv:opensanger', { detail:{ name:f.name, buffer:buf } }))
              )
            } else {
              window.dispatchEvent(new CustomEvent(tool.event, { detail: f }))
            }
            onPick()
          }
          e.target.value = ''
        }}
      />
      <button
        onClick={() => ref.current.click()}
        style={{
          display:'flex', flexDirection:'column', gap:12, alignItems:'flex-start',
          padding:'20px 18px', borderRadius:14,
          border:`2px solid #e4edfb`,
          background:'#fff', cursor:'pointer',
          textAlign:'left', transition:'all .15s',
          boxShadow:'0 2px 8px rgba(20,50,140,.06)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = tool.color
          e.currentTarget.style.boxShadow   = `0 4px 20px ${tool.color}22`
          e.currentTarget.style.transform   = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#e4edfb'
          e.currentTarget.style.boxShadow   = '0 2px 8px rgba(20,50,140,.06)'
          e.currentTarget.style.transform   = 'none'
        }}
      >
        <div style={{ color:tool.color }}>{tool.icon}</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#0f2460', marginBottom:4 }}>{tool.label}</div>
          <div style={{ fontSize:12, color:'#5a7ec0', lineHeight:1.5 }}>{tool.desc}</div>
        </div>
        <div style={{
          marginTop:'auto', display:'flex', alignItems:'center', gap:6,
          fontSize:11, color:tool.color, fontWeight:600,
        }}>
          <FolderOpen size={12}/> {tool.accepts.split(',').map(e=>e.trim()).join('  ')}
        </div>
      </button>
    </>
  )
}

export default function ToolPicker({ activeCategory, onSelectCategory, onClose, onOpenTree }) {
  // If a category is selected, show its tools
  // Otherwise show the 4 main categories

  const tools =
    activeCategory === 'sequence' ? SEQUENCE_TOOLS :
    activeCategory === 'sanger'   ? SANGER_TOOLS   :
    activeCategory === 'matrix'   ? MATRIX_TOOLS   :
    null

  const cat = CATEGORIES.find(c => c.id === activeCategory)

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      background:'#f4f7ff', overflow:'auto',
    }}>
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40,
      }}>
        <div style={{ maxWidth:720, width:'100%' }}>

          {/* Header */}
          {!activeCategory ? (
            <>
              <div style={{ textAlign:'center', marginBottom:36 }}>
                {/* AriaDNA logo */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={56} height={56}
                  style={{ marginBottom:14 }}>
                  <defs>
                    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2060f0"/><stop offset="100%" stopColor="#0a2fa8"/>
                    </linearGradient>
                    <linearGradient id="ps1" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#90d0ff"/><stop offset="100%" stopColor="#4090ff"/>
                    </linearGradient>
                    <linearGradient id="ps2" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffe84a"/><stop offset="100%" stopColor="#ffb200"/>
                    </linearGradient>
                  </defs>
                  <rect width="64" height="64" rx="16" fill="url(#pg)"/>
                  <path d="M18 6C18 6,46 16,46 32C46 48,18 58,18 58" stroke="url(#ps1)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
                  <path d="M46 6C46 6,18 16,18 32C18 48,46 58,46 58" stroke="url(#ps2)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
                  <line x1="20" y1="13" x2="44" y2="18" stroke="rgba(255,255,255,.65)" strokeWidth="2.8" strokeLinecap="round"/>
                  <line x1="20" y1="30" x2="44" y2="30" stroke="rgba(255,255,255,.8)"  strokeWidth="2.8" strokeLinecap="round"/>
                  <line x1="20" y1="47" x2="44" y2="52" stroke="rgba(255,255,255,.65)" strokeWidth="2.8" strokeLinecap="round"/>
                </svg>
                <h1 style={{ fontSize:28, fontWeight:900, margin:'0 0 8px', letterSpacing:'-.5px',
                  background:'linear-gradient(90deg,#1a56db,#00c6ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  Aria<span style={{ background:'linear-gradient(90deg,#1a9fff,#00e5ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>DNA</span>
                </h1>
                <p style={{ fontSize:14, color:'#5a7ec0', margin:0 }}>
                  Genomic Viewer &amp; Analysis — choose a tool to get started
                </p>
              </div>

              {/* Category cards */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id}
                    onClick={() => cat.id === 'tree' ? onOpenTree() : onSelectCategory(cat.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:16, padding:'22px 20px',
                      borderRadius:14, border:`2px solid ${cat.color}22`,
                      background:cat.bg, cursor:'pointer', textAlign:'left',
                      transition:'all .15s', boxShadow:'0 2px 10px rgba(20,50,140,.07)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=cat.color; e.currentTarget.style.boxShadow=`0 6px 24px ${cat.color}28`; e.currentTarget.style.transform='translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=`${cat.color}22`; e.currentTarget.style.boxShadow='0 2px 10px rgba(20,50,140,.07)'; e.currentTarget.style.transform='none' }}
                  >
                    <div style={{ color:cat.color, flexShrink:0 }}>{cat.icon}</div>
                    <div>
                      <div style={{ fontSize:17, fontWeight:800, color:'#0f2460', marginBottom:4 }}>{cat.label}</div>
                      <div style={{ fontSize:12, color:'#5a7ec0', lineHeight:1.5 }}>{cat.desc}</div>
                    </div>
                    <div style={{ marginLeft:'auto', fontSize:20, color:`${cat.color}66` }}>›</div>
                  </button>
                ))}
              </div>

              <p style={{ textAlign:'center', fontSize:12, color:'#93b4f0', marginTop:24 }}>
                💡 Drop any file anywhere to open it
              </p>
            </>
          ) : (
            <>
              {/* Sub-category header */}
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
                <button
                  onClick={() => onSelectCategory(null)}
                  style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
                    cursor:'pointer', color:'var(--txt3)', fontSize:13, fontWeight:600, padding:'5px 0' }}
                >
                  <ArrowLeft size={16}/> Back
                </button>
                <div style={{ width:1, height:20, background:'var(--border)' }}/>
                <div style={{ color:cat.color }}>{cat.icon}</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#0f2460' }}>{cat.label}</div>
                  <div style={{ fontSize:12, color:'#5a7ec0' }}>{cat.desc}</div>
                </div>
              </div>

              {/* Tool cards */}
              <div style={{ display:'grid', gridTemplateColumns: tools.length === 1 ? '1fr' : '1fr 1fr', gap:14 }}>
                {tools.map(tool => (
                  <ToolCard key={tool.id} tool={tool} onPick={onClose}/>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}