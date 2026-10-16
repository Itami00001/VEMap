export const MOOD_MIN_YEAR = 1905
export const MOOD_MAX_YEAR = 2026

export const COLOR_RED = '#c0392b'
export const COLOR_NEUTRAL = '#7ec8e3'
export const COLOR_GREEN = '#2ecc71'
// Серый — только для «нет данных» (NO_DATA '#39404e' в слоях).

export function ageFactor(year: number): number {
  // Максимум 0.5: 2026 → яркий цвет, 1905 → вполовину бледнее,
  // но красный/зелёный, а не голубой.
  return 0.5 * Math.max(0, Math.min(1, (MOOD_MAX_YEAR - year) / (MOOD_MAX_YEAR - MOOD_MIN_YEAR)))
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
  // Вариант 1 (реализован): HSL-десатурация — base старится в бледный
  // красный/зелёный; голубой остаётся только у norm ≈ 0.5.
  // Вариант 2 (отклонён): lerpColor(base, '#808080', factor) — тянет всё
  // к серому и убивает различие тёплый/холодный в старых годах.
  return desaturate(sentimentColor(norm), ageFactor(year))
}

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  let hh = 0
  if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (mx === g) hh = ((b - r) / d + 2) / 6
  else hh = ((r - g) / d + 4) / 6
  return [hh * 360, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((((h % 360) + 360) % 360) / 360 + 1) % 1
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${to(f(hh + 1 / 3))}${to(f(hh))}${to(f(hh - 1 / 3))}`
}

export function desaturate(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex)
  const t = Math.max(0, Math.min(1, amount))
  return hslToHex(h, s * (1 - t), l)
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