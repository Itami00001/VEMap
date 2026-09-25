import type { AdminMoodRecord, ImportStageResponse, Survey } from '../types'

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'mm_admin_token'

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body: unknown = await res.json()
      if (typeof body === 'object' && body !== null && 'detail' in body) {
        detail = String((body as { detail: unknown }).detail)
      }
    } catch {
      // no JSON body
    }
    throw new Error(`HTTP ${res.status}: ${detail}`)
  }
  return (await res.json()) as T
}

export const adminApi = {
  login: async (email: string, password: string): Promise<string> => {
    const body = await adminRequest<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    return body.access_token
  },
  listSurveys: () => adminRequest<Survey[]>('/api/admin/surveys'),
  createSurvey: (data: { year: number; title: string; status: string }) =>
    adminRequest<Survey>('/api/admin/surveys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSurvey: (id: number, data: Record<string, unknown>) =>
    adminRequest<Survey>(`/api/admin/surveys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSurvey: (id: number) =>
    adminRequest<{ ok: boolean }>(`/api/admin/surveys/${id}`, { method: 'DELETE' }),
  listData: () => adminRequest<AdminMoodRecord[]>('/api/admin/data'),
  updateData: (id: number, data: { mood_index?: number; is_public?: boolean }) =>
    adminRequest<{ ok: boolean }>(`/api/admin/data/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteData: (id: number) =>
    adminRequest<{ ok: boolean }>(`/api/admin/data/${id}`, { method: 'DELETE' }),
  import: (surveyId: number, data: unknown, confirm: boolean) =>
    adminRequest<ImportStageResponse>('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify({ survey_id: surveyId, data, confirm }),
    }),
  publish: (recordIds: number[]) =>
    adminRequest<{ ok: boolean }>('/api/admin/publish', {
      method: 'POST',
      body: JSON.stringify({ record_ids: recordIds }),
    }),
  export: () => adminRequest<{ dataset: string }>('/api/admin/export'),
  logs: () =>
    adminRequest<
      Array<{
        id: number
        admin_id: number
        action: string
        entity: string
        details: string | null
        created_at: string
      }>
    >('/api/admin/logs'),
}
