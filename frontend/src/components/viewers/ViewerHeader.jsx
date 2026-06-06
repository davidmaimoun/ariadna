import { X, Save, ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  ViewerHeader — shared header for ALL tool viewers
//  Same structure, viewer-specific color
// ─────────────────────────────────────────────────────────────────────────────

export const VIEWER_COLORS = {
  sequence: { color:'#1a56db', bg:'#eef3ff', label:'Sequence Viewer'  },
  msa:      { color:'#1a56db', bg:'#eef3ff', label:'MSA Viewer'       },
  sanger:   { color:'#059669', bg:'#ecfdf5', label:'Sanger Trace'     },
  vcf:      { color:'#1a56db', bg:'#eef3ff', label:'VCF Variants'     },
  bam:      { color:'#1a56db', bg:'#eef3ff', label:'SAM / BAM'        },
  blast:    { color:'#1a56db', bg:'#eef3ff', label:'BLAST Results'    },
  matrix:   { color:'#d97706', bg:'#fffbeb', label:'Matrix / Heatmap' },
  tree:     { color:'#7c3aed', bg:'#f5f3ff', label:'Phylogenetic Tree'},
}

export default function ViewerHeader({
  type,               // key in VIEWER_COLORS
  customLabel,        // override label
  onClose,            // required — closes the viewer
  onSave,             // optional — save button
  saveEnabled,        // boolean
  saveLabel,          // text for save button (default 'Save')
  sidebarOpen,        // boolean
  onToggleSidebar,    // show toggle button if provided
  children,           // extra controls in the middle
}) {
  const def = VIEWER_COLORS[type] || VIEWER_COLORS.sequence
  const { color, bg, label } = def

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      height:46, flexShrink:0, padding:'0 14px',
      background:'#fff',
      borderBottom:`2.5px solid ${color}`,
      boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {/* ── Viewer badge ───────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        padding:'4px 14px', borderRadius:8, flexShrink:0,
        background:bg, border:`1.5px solid ${color}44`,
        color, fontSize:12.5, fontWeight:800, letterSpacing:'-.01em',
      }}>
        {customLabel || label}
      </div>

      {/* ── Middle — tool-specific controls ────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, overflowX:'auto', minWidth:0 }}>
        {children}
      </div>

      {/* ── Right — sidebar toggle + save + close ──────── */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:32, height:32, borderRadius:7,
              border:'1.5px solid var(--border)',
              background: sidebarOpen ? bg : 'var(--bg)',
              color: sidebarOpen ? color : 'var(--txt3)',
              cursor:'pointer', transition:'all .15s',
            }}>
            {sidebarOpen ? <PanelRightClose size={15}/> : <PanelRightOpen size={15}/>}
          </button>
        )}

        {onSave && (
          <button
            onClick={onSave}
            disabled={!saveEnabled}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'5px 14px', borderRadius:7,
              border:`1.5px solid ${saveEnabled?color:'var(--border)'}`,
              background: saveEnabled ? color : 'var(--bg2)',
              color: saveEnabled ? '#fff' : 'var(--txt4)',
              fontSize:12.5, fontWeight:600, cursor: saveEnabled ? 'pointer' : 'not-allowed',
              transition:'all .15s',
            }}>
            <Save size={13}/> {saveLabel || 'Save'}
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'5px 14px', borderRadius:7,
            border:'1.5px solid #fde0d0',
            background:'#fff8f6', color:'#c0300e',
            fontSize:12.5, fontWeight:600, cursor:'pointer',
            transition:'all .15s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='#c0300e'; e.currentTarget.style.color='#fff' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='#fff8f6'; e.currentTarget.style.color='#c0300e' }}>
          <X size={13}/> Close
        </button>
      </div>
    </div>
  )
}
