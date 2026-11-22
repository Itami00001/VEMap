import { lazy, Suspense, useState } from 'react'
import { newspaperUrl } from '../../services/api'
import { formatPeriodTitle } from './TimeSlider'
import type { City, CityMood, NewspaperSource, TimePeriod } from '../../types'

const NewspaperReader = lazy(() => import('./NewspaperReader'))
const NewspaperThumbnail = lazy(() => import('./NewspaperThumbnail'))

export interface CityPanelProps {
  city: City | undefined
  cityId: string
  mood: CityMood | null
  period: TimePeriod | null
  loading: boolean
  error: boolean
  onOpenSource: (filename: string | null) => void
  onChat: (filename: string) => void
}

export default function CityPanel({ city, cityId, mood, period, loading, error, onOpenSource, onChat }: CityPanelProps) {
  const [selected, setSelected] = useState<NewspaperSource | null>(null)
  const sources = mood?.sources ?? []

  return (
    <div className="atlas-city-panel">
      <h2>{city?.name_ru ?? cityId}</h2>
      {period && <p>{formatPeriodTitle(period)}</p>}
      {loading ? <p role="status">Загрузка данных…</p> : error ? <p role="alert">Данные не загрузились.</p> : mood ? (
        <div className="atlas-city-metrics">
          <strong>{mood.mood_index.toLocaleString('ru', { maximumFractionDigits: 1 })} / 100</strong>
          <span>{mood.responses_count} · объём выборки</span>
        </div>
      ) : <p>За этот период нет данных.</p>}
      {!loading && !error && sources.length > 0 && (
        <ul className="atlas-city-sources">
          {sources.map((source) => {
            const { id, title, source_page: page, available } = source
            const active = selected?.id === id && selected.source_page === page
            return <li key={id + ':' + page}>
              {available && <Suspense fallback={null}>
                <NewspaperThumbnail url={newspaperUrl(id, page)} page={page} />
              </Suspense>}
              <div>
                <strong>{title}</strong>
                <p>Страница {page}{!available && ' · PDF недоступен'}</p>
                {available && <button className="btn primary" type="button" aria-expanded={active}
                  onClick={() => { setSelected(active ? null : source); onOpenSource(active ? null : id) }}>
                  {active ? 'Свернуть страницу' : 'Открыть страницу'}
                </button>}
              </div>
            </li>
          })}
        </ul>
      )}
      {mood && !loading && !sources.length && <p>Для этого периода источник не указан.</p>}
      {selected && <>
        <button className="btn atlas-source-chat" type="button" onClick={() => onChat(selected.id)}>Спросить об этом выпуске</button>
        <Suspense fallback={<p role="status">Загружаем просмотрщик…</p>}>
          <NewspaperReader key={selected.id + ':' + selected.source_page} initialPage={selected.source_page}
            url={newspaperUrl(selected.id, selected.source_page)} />
        </Suspense>
      </>}
    </div>
  )
}
