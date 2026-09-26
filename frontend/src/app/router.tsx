import { createBrowserRouter } from 'react-router-dom'
import Layout from './Layout'
import MapPage from '../pages/MapPage'

function Placeholder({ title }: { title: string }) {
  return <div className="page"><h1>{title}</h1><p className="muted">Раздел подготовлен для следующего этапа. DEMO DATA.</p></div>
}

export const router = createBrowserRouter([
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Placeholder title="MAP MOOD" /> },
    { path: 'map', element: <MapPage /> },
    { path: 'data', element: <Placeholder title="Данные" /> },
    { path: 'compare', element: <Placeholder title="Сравнение периодов" /> },
    { path: 'forecast', element: <Placeholder title="Прогноз" /> },
    { path: 'about', element: <Placeholder title="О проекте" /> },
  ] },
])
