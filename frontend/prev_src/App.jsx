import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './layout/AppShell'
import Home from './routes/Home'
import SequencePage from './routes/sequence/SequencePage'
import MSAPage      from './routes/msa/MSAPage'
import VCFPage      from './routes/vcf/VCFPage'
import BAMPage      from './routes/bam/BAMPage'
import BLASTPage    from './routes/blast/BLASTPage'
import TreePage     from './routes/tree/TreePage'
import MatrixPage   from './routes/matrix/MatrixPage'
import SangerPage   from './routes/sanger/SangerPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell/>}>
        <Route path="/" element={<Home/>}/>

        <Route path="/sequence"        element={<SequencePage/>}/>
        <Route path="/sequence/:docId" element={<SequencePage/>}/>
        <Route path="/msa/:docId"      element={<MSAPage/>}/>
        <Route path="/vcf/:docId"      element={<VCFPage/>}/>
        <Route path="/bam/:docId"      element={<BAMPage/>}/>
        <Route path="/blast/:docId"    element={<BLASTPage/>}/>

        <Route path="/tree"            element={<TreePage/>}/>
        <Route path="/tree/:docId"     element={<TreePage/>}/>

        <Route path="/matrix"          element={<MatrixPage/>}/>
        <Route path="/matrix/:docId"   element={<MatrixPage/>}/>

        <Route path="/sanger"          element={<SangerPage/>}/>
        <Route path="/sanger/:docId"   element={<SangerPage/>}/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Route>
    </Routes>
  )
}
