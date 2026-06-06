import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import BAMViewer from '../../components/viewers/BAMViewer'

export default function BAMPage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.bam)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'bam')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('bam', docId)
  }, [docId, doc, activeId])

  if (!docId) {
    if (activeId) return <Navigate to={`/bam/${activeId}`} replace/>
    return <Navigate to="/sequence" replace/>
  }
  if (!doc) return <Navigate to="/sequence" replace/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/bam/${rest[rest.length-1].id}` : '/sequence')
  }

  return (
    <ToolPage tool="bam" color="#1a56db" activeId={docId}>
      <BAMViewer key={docId} data={doc.data} onClose={close}/>
    </ToolPage>
  )
}
