import { createHashRouter, Navigate } from 'react-router-dom'
import Layout from './Layout'
import AboutPage from '../pages/AboutPage'
import ComparePage from '../pages/ComparePage'
import DataPage from '../pages/DataPage'
import Landing from '../pages/Landing'
import MapPage from '../pages/MapPage'
import WikiPage from '../pages/WikiPage'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminLogin from '../pages/admin/AdminLogin'

export const router = createHashRouter([
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Landing /> },
    { path: 'map', element: <MapPage /> },
    { path: 'data', element: <DataPage /> },
    { path: 'compare', element: <ComparePage /> },
    { path: 'wiki', element: <WikiPage /> },
    { path: 'forecast', element: <Navigate to="/wiki" replace /> },
    { path: 'about', element: <AboutPage /> },
    { path: 'admin/login', element: <AdminLogin /> },
    { path: 'admin', element: <AdminDashboard /> },
  ] },
])
