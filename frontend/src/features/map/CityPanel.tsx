import { lazy, Suspense, useState } from 'react'
import { newspaperUrl } from '../../services/api'
import { formatPeriod } from './TimeSlider'
import type { City, CityMood, TimePeriod } from '../../types'
import type { NewspaperSource } from '../../services/api'

const NewspaperReader = lazy(() => import('./NewspaperReader'))

export interface CityPanelProps {
  city: City | undefined
  cityId: string
  mood: CityMood | null
  period: TimePeriod | null
  loading: boolean
  error: boolean
  activeSource: string | null
  onOpenSource: (filename: string) => void
  onClose: () => void
}

function closeness(mood: number | null): string {
  if (mood == null) return '—'
  if (mood >= 66.7) return 'good'
  if (mood >= 33.3) return 'neutral'
  return 'bad'
}

export default function CityPanel({ city, cityId, mood, period, loading, error, activeSource, onOpenSource, onClose }: CityPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<NewspaperSource | null>(null)
  const hasData = mood !== null && period !== null && !loading && !error
  const periodLabel = period ? formatPeriod(period) : ''

  return (
    <aside className="city-panel city-panel--bottom">
      <button type="button" className="close" onClick={onClose} aria-label="Закрыть">
        ✕
      </button>
      <div className="city-panel-row">
        <h3>{city?.name_ru ?? cityId}</h3>
        <button type="button" className="btn city-period-button" disabled={!hasData}
          aria-expanded={hasData && expanded} onClick={() => setExpanded(!expanded)}>
          {loading ? 'Загрузка…' : error ? 'Ошибка загрузки' : hasData ? `Информация за ${periodLabel}` : 'Нет данных'}
        </button>
      </div>
      {hasData && expanded && <div className="city-panel-row">
        <div className="popup-metric">
          <span>Mood</span>
          <b>{mood ? mood.mood_index.toFixed(1) : '—'}</b>
        </div>
        <div className="popup-metric">
          <span>Publication</span>
          <b>{mood?.responses_count ?? '—'}</b>
        </div>
        <div className="popup-metric">
          <span>Closer to</span>
          <b>{closeness(mood?.mood_index ?? null)}</b>
        </div>
      </div>}
      
      {hasData && expanded && (
        <div className="city-panel-newspaper">
          {mood?.sources?.length ? (
            <ul>
              {mood.sources.map(({ source_pdf, source_page, available }) => (
                <li key={source_pdf + ':' + source_page}>
                  {available ? (
                    <button type="button" className="btn newspaper-source-button"
                      aria-pressed={selected?.source_pdf === source_pdf && selected.source_page === source_page}
                      onClick={() => {
                        setSelected({ source_pdf, source_page })
                        onOpenSource(source_pdf)
                      }}>
                      Открыть источник · {source_pdf}, стр. {source_page}
                    </button>
                  ) : (
                    <span className="muted">PDF недоступен · {source_pdf}, стр. {source_page}</span>
                  )}
                  {activeSource === source_pdf && <span className="muted"> · выбран для чата</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Для этого периода источник не указан</p>
          )}
          {selected && <Suspense fallback={<p role="status">Загружаем просмотрщик…</p>}>
            <NewspaperReader key={`${selected.source_pdf}:${selected.source_page}`}
              url={newspaperUrl(selected.source_pdf, selected.source_page)} initialPage={selected.source_page} />
          </Suspense>}
        </div>
      )}
    </aside>
  )
}
