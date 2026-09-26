import { createBrowserRouter } from 'react-router-dom'
import Layout from './Layout'
import AboutPage from '../pages/AboutPage'
import ComparePage from '../pages/ComparePage'
import DataPage from '../pages/DataPage'
import ForecastPage from '../pages/ForecastPage'
import Landing from '../pages/Landing'
import MapPage from '../pages/MapPage'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminLogin from '../pages/admin/AdminLogin'

export const router = createBrowserRouter([
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Landing /> },
    { path: 'map', element: <MapPage /> },
    { path: 'data', element: <DataPage /> },
    { path: 'compare', element: <ComparePage /> },
    { path: 'forecast', element: <ForecastPage /> },
    { path: 'about', element: <AboutPage /> },
    { path: 'admin/login', element: <AdminLogin /> },
    { path: 'admin', element: <AdminDashboard /> },
  ] },
])
