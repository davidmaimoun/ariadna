import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// The marketing/docs landing lives at the site root ("/").
// The React app is served under "/app" — basename makes every in-app route
// (e.g. navigate('/tree')) resolve to /app/tree without touching any path.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/app">
      <App/>
    </BrowserRouter>
  </StrictMode>,
)