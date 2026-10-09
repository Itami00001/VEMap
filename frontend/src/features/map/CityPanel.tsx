import type { City, CityMood } from '../../types'

export interface CityPanelProps {
  city: City | undefined
  cityId: string
  mood: CityMood | null
  onClose: () => void
}

function closeness(mood: number | null): string {
  if (mood == null) return '—'
  if (mood >= 66.7) return 'good'
  if (mood >= 33.3) return 'neutral'
  return 'bad'
}

export default function CityPanel({ city, cityId, mood, onClose }: CityPanelProps) {
  return (
    <aside className="city-panel city-panel--bottom">
      <button type="button" className="close" onClick={onClose} aria-label="Закрыть">
        ✕
      </button>
      <div className="city-panel-row">
        <h3>{city?.name_ru ?? cityId}</h3>
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
      </div>
    </aside>
  )
}
