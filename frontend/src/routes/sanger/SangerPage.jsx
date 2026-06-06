import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import SangerViewer from '../../components/viewers/SangerViewer'
import SangerHome from './SangerHome'

export default function SangerPage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.sanger)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'sanger')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('sanger', docId)
  }, [docId, doc, activeId])

  if (docId === 'new') return <SangerHome/>
  if (!docId) {
    if (activeId) return <Navigate to={`/sanger/${activeId}`} replace/>
    return <SangerHome/>
  }
  if (!doc) return <SangerHome/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/sanger/${rest[rest.length-1].id}` : '/sanger')
  }

  return (
    <ToolPage tool="sanger" color="#059669" activeId={docId}>
      <SangerViewer key={docId} files={doc.data.files} onClose={close}/>
    </ToolPage>
  )
}
