export const MOOD_MIN_YEAR = 1905
export const MOOD_MAX_YEAR = 2026

export const COLOR_RED = '#c0392b'
export const COLOR_NEUTRAL = '#7ec8e3'
export const COLOR_GREEN = '#2ecc71'
// Серый — только для «нет данных» (NO_DATA '#39404e' в слоях).

export function ageFactor(year: number): number {
  return Math.max(0, Math.min(1, (MOOD_MAX_YEAR - year) / (MOOD_MAX_YEAR - MOOD_MIN_YEAR)))
}

export function lerpColor(a: string, b: string, t: number): string {
  const h1 = a.replace('#', '')
  const h2 = b.replace('#', '')
  const r1 = parseInt(h1.slice(0, 2), 16)
  const g1 = parseInt(h1.slice(2, 4), 16)
  const b_1 = parseInt(h1.slice(4, 6), 16)
  const r2 = parseInt(h2.slice(0, 2), 16)
  const g2 = parseInt(h2.slice(2, 4), 16)
  const b_2 = parseInt(h2.slice(4, 6), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b_3 = Math.round(b_1 + (b_2 - b_1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b_3.toString(16).padStart(2, '0')}`
}

export function sentimentColor(norm: number): string {
  const v = Math.max(0, Math.min(1, norm))
  if (v <= 0.5) {
    return lerpColor(COLOR_RED, COLOR_NEUTRAL, v * 2)
  }
  return lerpColor(COLOR_NEUTRAL, COLOR_GREEN, (v - 0.5) * 2)
}

export function moodColor(norm: number, year: number): string {
  const base = sentimentColor(norm)
  const factor = ageFactor(year)
  return lerpColor(base, COLOR_NEUTRAL, factor)
}

export function moodColorStops(): ReadonlyArray<readonly [number, string]> {
  return [
    [0, moodColor(0, MOOD_MAX_YEAR)],
    [25, moodColor(0.25, MOOD_MAX_YEAR)],
    [50, moodColor(0.5, MOOD_MAX_YEAR)],
    [75, moodColor(0.75, MOOD_MAX_YEAR)],
    [100, moodColor(1, MOOD_MAX_YEAR)],
  ]
}