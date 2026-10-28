import type { City, CityMood, TimePeriod } from '../../types'

export interface CityPanelProps {
  city: City | undefined
  cityId: string
  mood: CityMood | null
  period: TimePeriod | null
  onClose: () => void
}

function closeness(mood: number | null): string {
  if (mood == null) return '—'
  if (mood >= 66.7) return 'good'
  if (mood >= 33.3) return 'neutral'
  return 'bad'
}

// Крымские города
const CRIMEAN_CITIES = new Set([
  'Симферополь', 'Ялта', 'Керчь', 'Евпатория', 'Белогорск', 'Севастополь'
])

// Сопоставление периодов с файлами газет "Терджиман" (только подтверждённые соответствия)
const NEWSPAPER_MAPPING: Record<string, string> = {
  '1917-1': '000200_000018_RU_NLR_BIBL_A_012653926-Терджиман_1917_№_1_(1_янв).pdf',
  '1917-4': '000200_000018_RU_NLR_BIBL_A_012653976-Терджиман_1917_№_70_(1_апр).pdf',
  '1917-7': '000200_000018_RU_NLR_BIBL_A_012653983-Терджиман_1917_№_135_(2_июля).pdf',
  '1917-10': '000200_000018_RU_NLR_BIBL_A_012654037-Терджиман_1917_№_194_(5_окт).pdf',
}

function getNewspaperPath(city: City | undefined, period: TimePeriod | null): string | null {
  if (!city || !period) return null
  if (!CRIMEAN_CITIES.has(city.name_ru)) return null
  
  const key = `${period.year}-${period.month}`
  const filename = NEWSPAPER_MAPPING[key]
  if (!filename) return null
  
  return `${import.meta.env.BASE_URL}data/examples/terjiman/${period.year}/${filename}`
}

export default function CityPanel({ city, cityId, mood, period, onClose }: CityPanelProps) {
  const newspaperPath = getNewspaperPath(city, period)
  const isCrimean = city && CRIMEAN_CITIES.has(city.name_ru)

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
      
      {isCrimean && (
        <div className="city-panel-newspaper">
          {newspaperPath ? (
            <div className="newspaper-viewer">
              <h4>Газета «Терджиман»</h4>
              <div className="newspaper-content">
                <object 
                  data={newspaperPath} 
                  type="application/pdf"
                  className="newspaper-iframe"
                  title="Газета Терджиман"
                >
                  <p>Ваш браузер не поддерживает просмотр PDF. <a href={newspaperPath} target="_blank" rel="noopener noreferrer">Скачать файл</a></p>
                </object>
              </div>
            </div>
          ) : (
            <div className="newspaper-missing">
              <p>Для выбранного периода газета отсутствует</p>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
