import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFound, OverviewStub, RegionStub, SectionStub } from './pages/Placeholder'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<OverviewStub />} />
        <Route path="/map" element={<SectionStub title="Карта регионов" />} />
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
