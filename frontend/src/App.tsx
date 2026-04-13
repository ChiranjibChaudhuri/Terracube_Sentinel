import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ObjectExplorer = lazy(() => import('./pages/ObjectExplorer'))
const MapView = lazy(() => import('./pages/MapView'))
const CountryIntel = lazy(() => import('./pages/CountryIntel'))
const Briefing = lazy(() => import('./pages/Briefing'))
const Pipelines = lazy(() => import('./pages/Pipelines'))
const Ontology = lazy(() => import('./pages/Ontology'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-6 h-6 border-2 border-t-cyan-400 border-r-transparent border-b-cyan-400/30 border-l-transparent rounded-full animate-spin" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-5xl font-bold text-white mb-2">404</h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Page not found
      </p>
      <Link
        to="/"
        className="px-4 py-2 rounded-lg text-sm font-medium text-cyan-400 transition-colors hover:text-white"
        style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}
      >
        Return to Dashboard
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
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
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
