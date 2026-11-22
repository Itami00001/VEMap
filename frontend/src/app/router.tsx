import { createHashRouter, Navigate, useLocation } from 'react-router-dom'
import Layout from './Layout'
import AboutPage from '../pages/AboutPage'
import ComparePage from '../pages/ComparePage'
import DataPage from '../pages/DataPage'
import Landing from '../pages/Landing'
import ArchivePage, { ArchiveLayout } from '../pages/ArchivePage'
import MapPage from '../pages/MapPage'
import WikiPage from '../pages/WikiPage'
import WikiArticlePage from '../pages/WikiArticlePage'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminLogin from '../pages/admin/AdminLogin'

function LegacyDataPage() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/archive/data', search }} replace />
}

export const router = createHashRouter([
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Landing /> },
    { path: 'map', element: <MapPage /> },
    { path: 'archive', element: <ArchiveLayout />, children: [
      { index: true, element: <ArchivePage /> },
      { path: 'data', element: <DataPage /> },
    ] },
    { path: 'data', element: <LegacyDataPage /> },
    { path: 'compare', element: <ComparePage /> },
    { path: 'wiki', element: <WikiPage /> },
    { path: 'wiki/:id', element: <WikiArticlePage /> },
    { path: 'forecast', element: <Navigate to="/wiki" replace /> },
    { path: 'about', element: <AboutPage /> },
    { path: 'admin/login', element: <AdminLogin /> },
    { path: 'admin', element: <AdminDashboard /> },
  ] },
])
