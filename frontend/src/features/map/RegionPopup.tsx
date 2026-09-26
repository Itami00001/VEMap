import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import type { City, CityMood, HistoryPoint, MapPoint, Region, TimePeriod } from '../../types'
import RegionMiniChart from './RegionMiniChart'

export interface RegionDetailsProps {
  region: Region | undefined
  period: TimePeriod | null
  point: MapPoint | null
}

export function periodLabel(p: TimePeriod | null): string {
  if (!p) return '—'
  return p.month != null ? `${p.year}-${String(p.month).padStart(2, '0')}` : String(p.year)
}

export function RegionDetails({ region, period, point }: RegionDetailsProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [cityMoods, setCityMoods] = useState<Record<string, CityMood>>({})

  useEffect(() => {
    if (!region) return
    let cancelled = false
    api
      .getRegionHistory(region.region_id)
      .then((h) => {
        if (!cancelled) setHistory(h)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [region])

  useEffect(() => {
    if (!region || !period) return
    let cancelled = false
    Promise.all([api.getCities(), api.getCityMoods(period.year, period.month)])
      .then(([all, moods]) => {
        if (cancelled) return
        setCities(all.filter((c) => c.region_id === region.region_id))
        const map: Record<string, CityMood> = {}
        for (const m of moods) map[m.city_id] = m
        setCityMoods(map)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [region, period])

  if (!region) return null
  return (
    <div>
      <h3>{region.name_ru}</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {region.federal_district} · {region.region_id} · {periodLabel(period)}
      </div>
      {point ? (
        <>
          <div className="mood-value">{point.mood_index.toFixed(1)}</div>
          <div className="popup-metric">
            <span>Mood Index, {periodLabel(period)}</span>
          </div>
          <div className="popup-metric">
            <span>Ответов/статей</span>
            <b>{point.responses_count}</b>
          </div>
        </>
      ) : (
        <p className="no-data" style={{ margin: '6px 0 10px' }}>
          Нет данных за {periodLabel(period)}
        </p>
      )}
      {cities.length > 0 && (
        <div style={{ margin: '8px 0' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Города</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
            {cities.map((c) => {
              const m = cityMoods[c.city_id]
              return (
                <li key={c.city_id} className="popup-metric">
                  <span>{c.name_ru}</span>
                  <b>{m ? m.mood_index.toFixed(1) : '—'}</b>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div style={{ margin: '8px 0' }}>
        <RegionMiniChart history={history} />
      </div>
      <Link className="btn small" to={`/data?region=${region.region_id}`}>
        Подробнее
      </Link>
    </div>
  )
}

export interface RegionPopupProps extends RegionDetailsProps {
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  onClose: () => void
}

const POPUP_W = 300
const POPUP_H = 380

export default function RegionPopup({ x, y, containerWidth, containerHeight, onClose, ...details }: RegionPopupProps) {
  const left = Math.min(Math.max(8, x - POPUP_W / 2), Math.max(8, containerWidth - POPUP_W - 8))
  const below = y + 16 + POPUP_H < containerHeight
  const top = below ? y + 16 : Math.max(8, y - POPUP_H - 16)
  return (
    <div className="region-popup" style={{ left, top }}>
      <button type="button" className="close" onClick={onClose} aria-label="Закрыть">
        ✕
      </button>
      <RegionDetails {...details} />
    </div>
  )
}
