import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import type { HistoryPoint } from '../../types'

export interface RegionMiniChartProps {
  history: HistoryPoint[]
}

export default function RegionMiniChart({ history }: RegionMiniChartProps) {
  if (history.length < 2) {
    return <div className="muted" style={{ fontSize: 12, padding: '10px 0' }}>История: менее 2 наблюдений</div>
  }
  const data = history.map((h) => ({ year: h.year, v: h.mood_index }))
  return (
    <div style={{ width: '100%', height: 64 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: 6 }}>
          <YAxis domain={[0, 100]} hide />
          <Line type="monotone" dataKey="v" stroke="#4f8cff" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
