import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useDocStore } from '../../store/useDocStore'
import ToolPage from '../../layout/ToolPage'
import PhyloTree from '../../components/viewers/PhyloTree'
import TreeHome from './TreeHome'

export default function TreePage() {
  const { docId } = useParams()
  const navigate  = useNavigate()
  const allDocs   = useDocStore(s => s.docs)
  const activeId  = useDocStore(s => s.activeByTool.tree)
  const setActive = useDocStore(s => s.setActive)
  const removeDoc = useDocStore(s => s.removeDoc)
  const docs = allDocs.filter(d => d.tool === 'tree')
  const doc  = docId ? docs.find(d => d.id === docId) : null

  useEffect(() => {
    if (doc && activeId !== docId) setActive('tree', docId)
  }, [docId, doc, activeId])

  if (!docId) {
    if (activeId) return <Navigate to={`/tree/${activeId}`} replace/>
    return <TreeHome/>
  }
  if (!doc) return <TreeHome/>

  const close = () => {
    const rest = docs.filter(d => d.id !== docId)
    removeDoc(docId)
    navigate(rest.length ? `/tree/${rest[rest.length-1].id}` : '/tree')
  }

  return (
    <ToolPage tool="tree" color="#7c3aed" activeId={docId}>
      <PhyloTree key={docId} data={null} onClose={close} autoLoad={doc.data} onAutoLoaded={() => {}}/>
    </ToolPage>
  )
}
