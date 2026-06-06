import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import VCFViewer from '../../components/viewers/VCFViewer'

export default function VCFPage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.vcf)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'vcf')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('vcf', docId)
  }, [docId, doc, activeId])

  if (docId === 'new') return <Navigate to="/sequence/new" replace/>
  if (!docId) {
    if (activeId) return <Navigate to={`/vcf/${activeId}`} replace/>
    return <Navigate to="/sequence" replace/>
  }
  if (!doc) return <Navigate to="/sequence" replace/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/vcf/${rest[rest.length-1].id}` : '/sequence')
  }

  return (
    <ToolPage tool="vcf" color="#1a56db" activeId={docId}>
      <VCFViewer key={docId} data={doc.data} onClose={close}/>
    </ToolPage>
  )
}
