import { X, Save, FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Sep } from './ToolbarFeatures'


// Where the "Open" button sends you to add another file of this kind
const PICKER_ROUTE = {
  sequence:'/sequence/new', msa:'/sequence/new', vcf:'/sequence/new',
  bam:'/sequence/new', blast:'/sequence/new',
  tree:'/tree/new', matrix:'/matrix/new', sanger:'/sanger/new',
}

export const VIEWER_COLORS = {
  sequence: { color:'#1a56db', bg:'#eef3ff', label:'Sequence Viewer'   },
  msa:      { color:'#1a56db', bg:'#eef3ff', label:'MSA Viewer'        },
  sanger:   { color:'#059669', bg:'#ecfdf5', label:'Sanger Trace'      },
  vcf:      { color:'#1a56db', bg:'#eef3ff', label:'VCF Variants'      },
  bam:      { color:'#1a56db', bg:'#eef3ff', label:'SAM / BAM'         },
  blast:    { color:'#1a56db', bg:'#eef3ff', label:'BLAST Results'     },
  matrix:   { color:'#d97706', bg:'#fffbeb', label:'Matrix / Heatmap'  },
  tree:     { color:'#7c3aed', bg:'#f5f3ff', label:'Phylogenetic Tree' },
}

// ─────────────────────────────────────────────────────────────────────────────
//  CommonToolbar — base for ALL viewer toolbars
//  Layout: [badge] | [children] ········ [save?] | [close]
// ─────────────────────────────────────────────────────────────────────────────
export default function CommonToolbar({
  type,                 // key in VIEWER_COLORS
  label,                // override label text
  onClose,              // required
  onSave,               // optional — shows Save button
  saveEnabled = false,
  saveLabel   = 'Save',
  children,             // tool-specific controls
}) {
  const navigate = useNavigate()
  const def = VIEWER_COLORS[type] || VIEWER_COLORS.sequence
  const color = def.color
  const bg    = def.bg
  const pickerRoute = PICKER_ROUTE[type] || '/'

  return (
    <div style={{
      display:'flex', alignItems:'center', height:46, flexShrink:0,
      padding:'0 16px', background:'#fff',
      borderBottom:`2.5px solid ${color}`,
      boxShadow:'0 2px 8px rgba(0,0,0,0.06)', gap:0,
    }}>

      {/* ── Fixed left: badge + Open ─────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', flexShrink:0, gap:0 }}>
        <div style={{
          padding:'4px 14px', borderRadius:8,
          background:bg, border:`1.5px solid ${color}44`,
          color, fontSize:12.5, fontWeight:800, whiteSpace:'nowrap', letterSpacing:'-.01em',
        }}>
          {label || def.label}
        </div>
        <Sep/>
        <button onClick={() => navigate(pickerRoute)} title="Open another file"
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7,
            border:`1.5px solid ${color}44`, background:'#fff', color, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = bg }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
          <FolderOpen size={13}/> Open
        </button>
      </div>

      {/* ── Scrollable middle: tool-specific controls ────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', flex:1, gap:6, overflowX:'auto', minWidth:0, padding:'0 6px' }}>
        {children}
      </div>

      {/* ── Fixed right: Save + Close (never cut off) ────────────────────── */}
      {/* Save — optional */}
      {onSave && (
        <>
          <Sep/>
          <button onClick={onSave} disabled={!saveEnabled} style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'5px 14px', borderRadius:7, flexShrink:0,
            border:`1.5px solid ${saveEnabled ? color : 'var(--border)'}`,
            background: saveEnabled ? color : 'var(--bg2)',
            color: saveEnabled ? '#fff' : 'var(--txt4)',
            fontSize:12, fontWeight:600,
            cursor: saveEnabled ? 'pointer' : 'not-allowed',
            transition:'all .15s',
          }}>
            <Save size={12}/> {saveLabel}
          </button>
        </>
      )}

      {/* Close — always */}
      <Sep/>
      <button onClick={onClose} style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'5px 14px', borderRadius:7, flexShrink:0,
        border:'1.5px solid #fde0d0', background:'#fff8f6',
        color:'#c0300e', fontSize:12, fontWeight:600, cursor:'pointer',
        transition:'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background='#c0300e'; e.currentTarget.style.color='#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background='#fff8f6'; e.currentTarget.style.color='#c0300e' }}>
        <X size={13}/> Close
      </button>
    </div>
  )
}