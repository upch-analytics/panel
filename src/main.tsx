import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { DataProvider } from './data/load'
import { ToastProvider } from './components/Toast'

// HashRouter: адреса вида #/region/38 работают на GitHub Pages без настройки сервера
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <DataProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DataProvider>
    </HashRouter>
  </StrictMode>,
)
