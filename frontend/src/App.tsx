import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ObjectExplorer from './pages/ObjectExplorer'
import MapView from './pages/MapView'
import CountryIntel from './pages/CountryIntel'
import Briefing from './pages/Briefing'
import Pipelines from './pages/Pipelines'
import Ontology from './pages/Ontology'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="objects" element={<ObjectExplorer />} />
            <Route path="map" element={<MapView />} />
            <Route path="country" element={<CountryIntel />} />
            <Route path="briefing" element={<Briefing />} />
            <Route path="pipelines" element={<Pipelines />} />
            <Route path="ontology" element={<Ontology />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
