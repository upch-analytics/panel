import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFound, RegionStub, SectionStub } from './pages/Placeholder'
import { MapPage, Overview } from './pages/Overview'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/regions" element={<SectionStub title="Региональная аналитика" />} />
        <Route path="/region/:code" element={<RegionStub />} />
        <Route path="/appeals" element={<SectionStub title="Обращения" />} />
        <Route path="/appeals/:id" element={<SectionStub title="Карточка обращения" />} />
        <Route path="/reports" element={<SectionStub title="Отчетность" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
