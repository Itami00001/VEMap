import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { api, newspaperUrl } from '../services/api'
import type { NewspaperCatalog } from '../services/api'
import type { NewspaperSource } from '../types'
import type { LayoutContext } from '../app/Layout'
import { useOutletContext } from 'react-router-dom'

const NewspaperReader = lazy(() => import('../features/map/NewspaperReader'))
const NewspaperThumbnail = lazy(() => import('../features/map/NewspaperThumbnail'))
const PAGE_SIZE = 12

export function ArchiveLayout() {
  const context = useOutletContext<LayoutContext>()
  return <div className="page atlas-page">
    <div className="atlas-page-heading"><h1>Архив газет</h1></div>
    <nav className="atlas-tabs" aria-label="Разделы архива">
      <NavLink end to="/archive">Выпуски</NavLink>
      <NavLink to="/archive/data">Данные</NavLink>
    </nav>
    <Outlet context={context} />
  </div>
}

function publicationYear(issue: NewspaperSource) {
  const text = issue.title + ' ' + issue.source_pdf
  return text.match(/(?<!\d)((?:18|19|20)\d{2})(?:\d{4})?(?!\d)/)?.[1] ?? ''
}

function ArchiveReader({ issue, onClose, onChat }: {
  issue: NewspaperSource; onClose: () => void; onChat: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [])

  return <dialog ref={dialog} className="atlas-archive-reader" aria-labelledby="archive-reader-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header>
      <h2 id="archive-reader-title">{issue.title}</h2>
      <button className="btn" type="button" onClick={onClose}>Закрыть</button>
    </header>
    <button className="btn primary" type="button" onClick={onChat}>Спросить об этом выпуске</button>
    <Suspense fallback={<p role="status">Загружаем просмотрщик…</p>}>
      <NewspaperReader url={newspaperUrl(issue.id, issue.source_page)} initialPage={issue.source_page} />
    </Suspense>
  </dialog>
}

export default function ArchivePage() {
  const [catalog, setCatalog] = useState<NewspaperCatalog | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [year, setYear] = useState('')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useSearchParams()
  const { setChatSource, setChatOpen } = useOutletContext<LayoutContext>()

  useEffect(() => {
    const controller = new AbortController()
    api.getNewspapers(controller.signal).then((data) => {
      if (!controller.signal.aborted) setCatalog(data)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [])

  const available = catalog?.archive.filter((item) => item.available) ?? []
  const years = [...new Set(available.map(publicationYear).filter(Boolean))].sort()
  const selectedCity = catalog?.cities.find((item) => item.city_id === city)
  const input = query.trim().toLocaleLowerCase('ru')
  const filtered = (selectedCity?.sources ?? available).filter((item) => item.available &&
    (!year || publicationYear(item) === year) && (item.title + ' ' + item.source_pdf).toLocaleLowerCase('ru').includes(input))
  const issueId = search.get('issue')
  const issue = available.find((item) => item.id === issueId || item.source_pdf === issueId)
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return <>
    <div className="atlas-archive-filters">
      <input type="search" aria-label="Поиск по выпускам" placeholder="Поиск по названию выпуска"
        value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} />
      <select aria-label="Город" value={city} onChange={(event) => { setCity(event.target.value); setPage(0) }}>
        <option value="">Все города</option>
        {catalog?.cities.filter((item) => item.sources.some((source) => source.available))
          .map((item) => <option key={item.city_id} value={item.city_id}>{item.name_ru}</option>)}
      </select>
      <select aria-label="Год" value={year} onChange={(event) => { setYear(event.target.value); setPage(0) }}>
        <option value="">Все годы</option>
        {years.map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
    {error && <p className="alert error" role="alert">Не удалось загрузить архив газет.</p>}
    {!catalog && !error && <p role="status">Загрузка архива…</p>}
    {catalog && !filtered.length && <p>По этим фильтрам выпуски не найдены.</p>}
    {catalog && issueId && !issue && <p className="alert error" role="alert">Выпуск не найден в архиве.</p>}
    <div className="atlas-issue-grid">
      {visible.map((item) => <article key={item.id} className="atlas-issue">
        <Suspense fallback={<div className="atlas-pdf-thumb" aria-hidden="true">PDF</div>}>
          <NewspaperThumbnail url={newspaperUrl(item.id, 1)} />
        </Suspense>
        <div>
          <h2>{item.title}</h2>
          {publicationYear(item) && <p>{publicationYear(item)}</p>}
          <button type="button" className="btn primary" onClick={() => setSearch({ issue: item.id })}>Открыть выпуск</button>
        </div>
      </article>)}
    </div>
    {pageCount > 1 && <nav className="atlas-pagination" aria-label="Страницы архива">
      <button className="btn" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button>
      <span aria-live="polite">{page + 1} / {pageCount}</span>
      <button className="btn" type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Далее</button>
    </nav>}
    {issue && <ArchiveReader key={issue.id} issue={issue} onClose={() => setSearch({}, { replace: true })}
      onChat={() => {
        setSearch({}, { replace: true })
        setChatSource({ cityId: 'archive', filename: issue.id })
        setChatOpen(true)
      }} />}
  </>
}
