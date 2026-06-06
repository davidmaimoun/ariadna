import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import MatrixViewer from '../../components/viewers/MatrixViewer'
import MatrixHome from './MatrixHome'

export default function MatrixPage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.matrix)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'matrix')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('matrix', docId)
  }, [docId, doc, activeId])

  if (!docId) {
    if (activeId) return <Navigate to={`/matrix/${activeId}`} replace/>
    return <MatrixHome/>
  }
  if (!doc) return <MatrixHome/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/matrix/${rest[rest.length-1].id}` : '/matrix')
  }

  return (
    <ToolPage tool="matrix" color="#d97706" activeId={docId}>
      <MatrixViewer key={docId} data={doc.data} onClose={close}/>
    </ToolPage>
  )
}
