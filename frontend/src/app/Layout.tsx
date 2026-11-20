import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import NewspaperChat from '../features/map/NewspaperChat'
import { api } from '../services/api'
import type { NewspaperCatalog } from '../services/api'

interface ChatSelection {
  cityId: string
  filename: string
}

export interface LayoutContext {
  chatOpen: boolean
  setChatSource: (source: ChatSelection | null) => void
}

export default function Layout() {
  const [inverted, setInverted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatSource, setChatSource] = useState<ChatSelection | null>(null)
  const [catalog, setCatalog] = useState<NewspaperCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const chatButton = useRef<HTMLButtonElement>(null)
  const onMap = useLocation().pathname === '/map'

  useEffect(() => {
    if (!chatOpen) return
    const controller = new AbortController()
    setCatalogError(false)
    api.getNewspapers(controller.signal).then((data) => {
      if (!controller.signal.aborted) setCatalog(data)
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError(true)
    })
    return () => controller.abort()
  }, [chatOpen])

  function toggleTheme() {
    document.documentElement.style.filter = inverted ? '' : 'invert(1) hue-rotate(180deg)'
    setInverted(!inverted)
  }

  return (
    <div className={`app-shell${onMap && chatOpen ? ' map-chat-open' : ''}`}>
      <header className="site-header">
        <NavLink to="/" className="brand">
          VEMAP
        </NavLink>
        <nav className="main-nav">
          <NavLink to="/map">Карта</NavLink>
          <NavLink to="/data">Данные</NavLink>
          <NavLink to="/compare">Сравнение</NavLink>
          <NavLink to="/wiki">VEMAP Viki</NavLink>
          <NavLink to="/about">О проекте</NavLink>
        </nav>
        <div className="nav-actions">
          <button type="button" className="nav-icon" aria-label="Светлая тема" title="Сменить тему"
            aria-pressed={inverted} onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {inverted
                ? <path d="M20.8 15.4A9 9 0 0 1 8.6 3.2 9 9 0 1 0 20.8 15.4Z" />
                : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>}
            </svg>
          </button>
          <button ref={chatButton} type="button" className="nav-icon nav-icon-chat"
            aria-label="Чат с ИИ" title="Чат с ИИ" aria-expanded={chatOpen}
            aria-controls="newspaper-chat" onClick={() => setChatOpen(!chatOpen)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 17H4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-5 4Z" />
              <path d="M8 10.5h.01m3.99 0h.01m3.99 0h.01" strokeWidth="2.5" />
            </svg>
          </button>
        </div>
      </header>
      <main className="site-main">
        <Outlet context={{ chatOpen, setChatSource } satisfies LayoutContext} />
      </main>
      <footer className="site-footer">
        <span>VEMap · Историческая пресса на карте</span>
      </footer>
      <NewspaperChat open={chatOpen} selection={chatSource} onSelect={setChatSource}
        catalog={catalog} catalogError={catalogError}
        onClose={() => { setChatOpen(false); chatButton.current?.focus() }} />
    </div>
  )
}
