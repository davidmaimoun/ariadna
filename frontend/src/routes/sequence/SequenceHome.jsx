import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dna, FileText, AlignJustify, Layers, BarChart3, FolderOpen } from 'lucide-react'
import { useDocStore } from '../../store/useDocStore'
import { useStore } from '../../store/useStore'
import { parseVCF }   from '../../components/viewers/VCFViewer'
import { parseSAM }   from '../../components/viewers/BAMViewer'
import { parseBlast } from '../../components/viewers/BLASTViewer'

function looksLikeMSA(seqs) {
  if (seqs.length < 2) return false
  const lens = new Set(seqs.map(s => s.seq.length)); if (lens.size !== 1) return false
  const gaps = seqs.reduce((n,s) => n + (s.seq.match(/-/g)||[]).length, 0)
  return (gaps / (seqs.length * seqs[0].seq.length)) > 0.01
}
function parseFasta(text) {
  const seqs = []; let cur = null
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('>')) { if (cur) seqs.push(cur); cur = { id:t.slice(1).split(' ')[0], seq:'' } }
    else if (cur) cur.seq += t
  }
  if (cur) seqs.push(cur)
  return seqs
}

// File-type cards for the sequence/genomics tool
const CARDS = [
  { id:'fasta', label:'FASTA / GenBank', icon:Dna,          color:'#1a56db', accepts:'.fasta,.fa,.fna,.ffn,.gb,.gbk,.genbank,.txt',
    desc:'Nucleotide or protein sequence viewer with annotations, GC content, ORFs.' },
  { id:'msa',   label:'Alignment (MSA)', icon:AlignJustify, color:'#1a56db', accepts:'.afa,.aln,.msa,.fasta,.fa',
    desc:'Multiple sequence alignment — conservation, consensus, colored columns.' },
  { id:'vcf',   label:'Variants (VCF)',  icon:Layers,       color:'#0e8c9e', accepts:'.vcf',
    desc:'Variant call format — SNPs, indels, filters, genotypes.' },
  { id:'bam',   label:'Alignments (SAM)',icon:BarChart3,    color:'#6b40a8', accepts:'.sam',
    desc:'Read alignments — coverage, mapping, per-base pileup.' },
  { id:'blast', label:'BLAST results',   icon:FileText,     color:'#cc7000', accepts:'.txt,.tsv,.xml,.json,.out',
    desc:'BLAST tabular / XML / JSON — hits, identity, e-values.' },
]

export default function SequenceHome() {
  const navigate = useNavigate()
  const addDoc   = useDocStore(s => s.addDoc)
  const refs     = useRef({})

  const handle = async (cardId, file) => {
    try {
      if (cardId === 'vcf')   { const id = addDoc('vcf',   file.name, parseVCF(await file.text()));   return navigate(`/vcf/${id}`) }
      if (cardId === 'bam')   { const id = addDoc('bam',   file.name, parseSAM(await file.text()));   return navigate(`/bam/${id}`) }
      if (cardId === 'blast') { const id = addDoc('blast', file.name, parseBlast(await file.text(), file.name)); return navigate(`/blast/${id}`) }

      // fasta / msa
      const seqs = parseFasta(await file.text())
      if (!seqs.length) { useStore.getState().notify('No sequences found', 'error'); return }
      const isMSA = cardId === 'msa' || /\.(afa|aln|msa)$/i.test(file.name) || looksLikeMSA(seqs)
      if (isMSA) { const id = addDoc('msa', file.name, { seqs }); return navigate(`/msa/${id}`) }
      const id = addDoc('sequence', file.name, { seqs, fileName:file.name, activeContig:0 })
      navigate(`/sequence/${id}`)
    } catch (e) {
      useStore.getState().notify(`${cardId.toUpperCase()} error: ${e.message}`, 'error')
    }
  }

  return (
    <div style={{ height:'100%', overflow:'auto', padding:'32px 24px', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
        <Dna size={22} color="#1a56db"/>
        <h2 style={{ fontSize:20, fontWeight:800, color:'#0f2460' }}>Sequence & Genomics</h2>
      </div>
      <p style={{ fontSize:13, color:'#5a7ec0', marginBottom:24 }}>Pick a file type to open</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14, maxWidth:720, width:'100%' }}>
        {CARDS.map(c => {
          const Icon = c.icon
          return (
            <div key={c.id}>
              <input ref={el => refs.current[c.id]=el} type="file" accept={c.accepts} style={{ display:'none' }}
                onChange={e => { const f=e.target.files[0]; if(f) handle(c.id, f); e.target.value='' }}/>
              <button onClick={() => refs.current[c.id]?.click()}
                style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', gap:8, padding:'18px 16px',
                  borderRadius:12, textAlign:'left', cursor:'pointer',
                  border:`2px solid ${c.color}22`, background:'#fff', transition:'all .15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=c.color; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 18px ${c.color}1f` }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${c.color}22`; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
                <div style={{ color:c.color }}><Icon size={24}/></div>
                <div style={{ fontSize:16.5, fontWeight:800, color:'#0f2460' }}>{c.label}</div>
                <div style={{ fontSize:13, color:'#5a7ec0', lineHeight:1.5 }}>{c.desc}</div>
                <div style={{ fontSize:11.5, color:c.color, fontWeight:600, marginTop:'auto', paddingTop:6 }}>
                  <FolderOpen size={10} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }}/>
                  {c.accepts.split(',').slice(0,4).join(' ')}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}