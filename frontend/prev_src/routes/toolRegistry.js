// Central registry of all tools — colors, labels, routes, accepted files.
// Add a new tool here and it shows up in nav + home automatically.

export const TOOLS = {
  sequence: {
    id:'sequence', label:'Sequence', color:'#1a56db',
    path:'/sequence', icon:'Dna',
    blurb:'FASTA / GenBank viewer with annotations, GC content, ORFs, translation.',
    accepts:'.fasta,.fa,.fna,.gb,.gbk,.genbank,.txt',
  },
  tree: {
    id:'tree', label:'Tree', color:'#7c3aed',
    path:'/tree', icon:'GitBranch',
    blurb:'Phylogenetic trees: NJ, UPGMA, MST, GoeBURST, or load Newick.',
    accepts:'.nwk,.tre,.tree,.tsv,.csv,.txt',
  },
  matrix: {
    id:'matrix', label:'Matrix', color:'#d97706',
    path:'/matrix', icon:'Grid3x3',
    blurb:'Distance / allelic matrix heatmap, table and presence-absence.',
    accepts:'.tsv,.csv,.txt,.tab',
  },
  sanger: {
    id:'sanger', label:'Sanger', color:'#059669',
    path:'/sanger', icon:'Microscope',
    blurb:'AB1 chromatogram viewer with base editing and quality scores.',
    accepts:'.ab1',
  },
}

export const TOOL_LIST = Object.values(TOOLS)
