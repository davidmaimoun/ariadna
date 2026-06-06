import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import MSAViewer from '../../components/viewers/MSAViewer'

export default function MSAPage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.msa)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'msa')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('msa', docId)
  }, [docId, doc, activeId])

  if (!docId) {
    if (activeId) return <Navigate to={`/msa/${activeId}`} replace/>
    return <Navigate to="/sequence" replace/>
  }
  if (!doc) return <Navigate to="/sequence" replace/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/msa/${rest[rest.length-1].id}` : '/sequence')
  }

  return (
    <ToolPage tool="msa" color="#1a56db" activeId={docId}>
      <MSAViewer key={docId} sequences={doc.data.seqs} onClose={close}/>
    </ToolPage>
  )
}
