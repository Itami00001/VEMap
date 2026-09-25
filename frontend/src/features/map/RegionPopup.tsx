import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import type { HistoryPoint, MapPoint, Region } from '../../types'
import RegionMiniChart from './RegionMiniChart'

export interface RegionDetailsProps {
  region: Region | undefined
  year: number | null
  point: MapPoint | null
}

export function RegionDetails({ region, year, point }: RegionDetailsProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([])

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

  if (!region) return null
  return (
    <div>
      <h3>{region.name_ru}</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {region.federal_district} · {region.region_id}
      </div>
      {point ? (
        <>
          <div className="mood-value">{point.mood_index.toFixed(1)}</div>
          <div className="popup-metric">
            <span>Mood Index, {year}</span>
          </div>
          <div className="popup-metric">
            <span>Ответов</span>
            <b>{point.responses_count}</b>
          </div>
        </>
      ) : (
        <p className="no-data" style={{ margin: '6px 0 10px' }}>
          Нет данных за {year} год
        </p>
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
const POPUP_H = 320

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
