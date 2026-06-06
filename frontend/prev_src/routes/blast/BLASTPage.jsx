import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import BLASTViewer from '../../components/viewers/BLASTViewer'

export default function BLASTPage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.blast)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'blast')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('blast', docId)
  }, [docId, doc, activeId])

  if (!docId) {
    if (activeId) return <Navigate to={`/blast/${activeId}`} replace/>
    return <Navigate to="/sequence" replace/>
  }
  if (!doc) return <Navigate to="/sequence" replace/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/blast/${rest[rest.length-1].id}` : '/sequence')
  }

  return (
    <ToolPage tool="blast" color="#1a56db" activeId={docId}>
      <BLASTViewer key={docId} data={doc.data} onClose={close}/>
    </ToolPage>
  )
}
