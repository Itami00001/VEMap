import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand">
          MAP&nbsp;MOOD
        </NavLink>
        <nav className="main-nav">
          <NavLink to="/map">Карта</NavLink>
          <NavLink to="/data">Данные</NavLink>
          <NavLink to="/compare">Сравнение</NavLink>
          <NavLink to="/forecast">Прогноз</NavLink>
          <NavLink to="/about">О проекте</NavLink>
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>MAP MOOD — аналитическая платформа настроений регионов России</span>
        <span>Текущие данные: DEMO DATA (демонстрационные, не реальные)</span>
      </footer>
    </div>
  )
}
