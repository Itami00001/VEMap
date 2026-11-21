const BASE_URL: string = import.meta.env.VITE_API_URL ?? ''
const ROOT = BASE_URL + '/api/wiki/articles'

export interface WikiSummary {
  id: string
  title: string
  summary: string
  date: string
  processing: 'waiting' | 'queued' | 'running' | 'ready' | 'failed'
  file_count: number
  point_count: number
}

export interface WikiPoint {
  name: string
  lat: number
  lon: number
  mood_index: number | null
  file_index: number | null
  page: number | null
}

export interface WikiArticle extends WikiSummary {
  body: string
  files: Array<{ name: string; size: number }>
  points: WikiPoint[]
}

interface WikiCatalogue {
  accepting: boolean
  paused: boolean
  articles: WikiSummary[]
  next: string | null
}

async function wikiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)
  if (!response.ok || data === null) {
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Не удалось выполнить запрос к Вики.')
  }
  return data as T
}

export const wiki = {
  list: (signal: AbortSignal, before: string | null) =>
    wikiRequest<WikiCatalogue>(before ? ROOT + "?before=" + encodeURIComponent(before) : ROOT, { signal }),
  get: (id: string, signal: AbortSignal) => wikiRequest<WikiArticle>(ROOT + '/' + encodeURIComponent(id), { signal }),
  submit: (data: FormData, id: string, signal: AbortSignal) => wikiRequest<{ id: string }>(ROOT, {
    method: 'POST', body: data, headers: { 'X-Submission-ID': id }, signal,
  }),
  pdf: (id: string, index: number, page?: number | null) =>
    `${ROOT}/${encodeURIComponent(id)}/files/${index}${page ? '#page=' + page : ''}`,
  csv: (id: string) => `${ROOT}/${encodeURIComponent(id)}/points.csv`,
}
