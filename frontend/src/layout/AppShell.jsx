import { Outlet } from 'react-router-dom'
import TopBar       from '../components/layout/TopBar'
import Footer       from '../components/layout/Footer'
import Notification from '../components/common/Notification'
import GlobalTabBar from './GlobalTabBar'

export default function AppShell() {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>
      <TopBar/>
      <GlobalTabBar/>
      <div style={{ flex:1, overflow:'hidden', minHeight:0, position:'relative' }}>
        <Outlet/>
      </div>
      <Notification/>
      <Footer/>
    </div>
  )
}
