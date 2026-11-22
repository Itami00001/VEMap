import { Link } from 'react-router-dom'
import type { CityDataRow } from '../../types'
import { sentimentColor } from '../map/color'

export interface RegionTableProps {
  rows: CityDataRow[]
  sortKey: 'name' | 'mood' | 'change'
  sortDir: 1 | -1
  onSort: (key: 'name' | 'mood' | 'change') => void
  period?: string | null
}

function fmt(v: number | null): string {
  return v == null ? '—' : v.toFixed(1)
}

function deltaFmt(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}

export default function RegionTable({ rows, sortKey, sortDir, onSort, period }: RegionTableProps) {
  const arrow = (k: 'name' | 'mood' | 'change') => (sortKey === k ? (sortDir === 1 ? ' ▲' : ' ▼') : '')
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th><button type="button" className="th-sort" onClick={() => onSort('name')}>Город{arrow('name')}</button></th>
          <th>Регион</th>
          <th><button type="button" className="th-sort" onClick={() => onSort('mood')}>Индекс настроения{arrow('mood')}</button></th>
          <th>Объём выборки</th>
          <th><button type="button" className="th-sort" onClick={() => onSort('change')}>Изменение{arrow('change')}</button></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.city_id}>
            <td><Link to={`/map?${new URLSearchParams(period ? { city: r.city_id, period } : { city: r.city_id })}`}>{r.name_ru}</Link></td>
            <td className="muted">{r.region_name}</td>
            <td><div className="atlas-index-cell">
              {r.mood_index != null && <span aria-hidden="true"><i style={{
                width: Math.max(0, Math.min(100, r.mood_index)) + '%', background: sentimentColor(r.mood_index / 100),
              }} /></span>}
              <b>{fmt(r.mood_index)}</b>
            </div></td>
            <td>{r.responses_count ?? '—'}</td>
            <td>{deltaFmt(r.change_from_prev)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
