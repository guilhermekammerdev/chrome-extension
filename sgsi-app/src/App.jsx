import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ToastProvider, Spinner } from './components/ui'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Ativos from './pages/Ativos'
import Riscos from './pages/Riscos'
import SoA from './pages/SoA'
import Documentos from './pages/Documentos'
import NaoConformidades from './pages/NaoConformidades'
import Auditorias from './pages/Auditorias'
import Incidentes from './pages/Incidentes'
import Fornecedores from './pages/Fornecedores'
import Objetivos from './pages/Objetivos'
import PartesInteressadas from './pages/PartesInteressadas'

function Protected({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    )
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/ativos" element={<Protected><Ativos /></Protected>} />
        <Route path="/riscos" element={<Protected><Riscos /></Protected>} />
        <Route path="/soa" element={<Protected><SoA /></Protected>} />
        <Route path="/documentos" element={<Protected><Documentos /></Protected>} />
        <Route path="/nao-conformidades" element={<Protected><NaoConformidades /></Protected>} />
        <Route path="/auditorias" element={<Protected><Auditorias /></Protected>} />
        <Route path="/incidentes" element={<Protected><Incidentes /></Protected>} />
        <Route path="/fornecedores" element={<Protected><Fornecedores /></Protected>} />
        <Route path="/objetivos" element={<Protected><Objetivos /></Protected>} />
        <Route path="/partes-interessadas" element={<Protected><PartesInteressadas /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
