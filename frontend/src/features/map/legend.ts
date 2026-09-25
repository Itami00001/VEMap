export const NO_DATA_COLOR = '#39404e'
const DELTA_NEUTRAL = '#3d4657'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

const MOOD_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, '#c0392b'],
  [25, '#e67e22'],
  [50, '#f1c40f'],
  [75, '#7cb342'],
  [100, '#2ecc71'],
]

export function moodColor(value: number): string {
  const v = Math.max(0, Math.min(100, value))
  for (let i = 1; i < MOOD_STOPS.length; i++) {
    const [s1, c1] = MOOD_STOPS[i - 1]
    const [s2, c2] = MOOD_STOPS[i]
    if (v <= s2) {
      return lerpColor(c1, c2, (v - s1) / (s2 - s1))
    }
  }
  return MOOD_STOPS[MOOD_STOPS.length - 1][1]
}

export interface LegendStep {
  label: string
  color: string
}

export function moodLegend(): LegendStep[] {
  const labels = ['0–20', '20–40', '40–60', '60–80', '80–100']
  return labels.map((label, i) => ({
    label,
    color: moodColor(i * 20 + 10),
  }))
}

export function deltaColor(delta: number): string {
  const d = Math.max(-10, Math.min(10, delta))
  if (d >= 0) return lerpColor(DELTA_NEUTRAL, '#4f8cff', d / 10)
  return lerpColor('#d64545', DELTA_NEUTRAL, (d + 10) / 10)
}

export function deltaLegend(): LegendStep[] {
  return [
    { label: 'падение', color: deltaColor(-8) },
    { label: '0', color: deltaColor(0) },
    { label: 'рост', color: deltaColor(8) },
  ]
}
