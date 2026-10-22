import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFound } from './pages/Common'
import { RegionPage } from './pages/RegionPage'
import { RegionsList } from './pages/RegionsList'
import { AppealCard, Appeals } from './pages/Appeals'
import { Reports } from './pages/Reports'
import { MapPage, Overview } from './pages/Overview'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/regions" element={<RegionsList />} />
        <Route path="/region/:code" element={<RegionPage />} />
        <Route path="/appeals" element={<Appeals />} />
        <Route path="/appeals/:id" element={<AppealCard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
