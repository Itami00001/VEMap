import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, clearAdminToken, getAdminToken } from '../../services/adminApi'
import type { AdminMoodRecord, ImportStageResponse, Survey } from '../../types'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [records, setRecords] = useState<AdminMoodRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newYear, setNewYear] = useState(2026)
  const [newTitle, setNewTitle] = useState('')
  const [importSurveyId, setImportSurveyId] = useState('')
  const [importJson, setImportJson] = useState('{}')
  const [importResult, setImportResult] = useState<ImportStageResponse | null>(null)

  useEffect(() => {
    if (!getAdminToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = () => {
    setError(null)
    adminApi.listSurveys().then(setSurveys).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    adminApi.listData().then(setRecords).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  const createSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminApi.createSurvey({ year: newYear, title: newTitle, status: 'draft' })
      setNewTitle('')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const removeSurvey = async (id: number) => {
    try {
      await adminApi.deleteSurvey(id)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const togglePublic = async (r: AdminMoodRecord) => {
    try {
      await adminApi.updateData(r.id, { is_public: !r.is_public })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const runImport = async (confirm: boolean) => {
    setError(null)
    setImportResult(null)
    try {
      const data: unknown = JSON.parse(importJson)
      const res = await adminApi.import(Number(importSurveyId), data, confirm)
      setImportResult(res)
      if (confirm && res.ok) refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const publishAll = async () => {
    try {
      await adminApi.publish(records.filter((r) => !r.is_public).map((r) => r.id))
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const logout = () => {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Панель администратора</h1>
          <p className="muted">Опросы, импорт JSON (validate → preview → import), публикация.</p>
        </div>
        <button type="button" className="btn small" onClick={logout}>Выйти</button>
      </div>
      {error && <div className="alert error">{error}</div>}

      <h2>Опросы</h2>
      <form className="filters" onSubmit={createSurvey}>
        <label>Год <input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} style={{ width: 90 }} /></label>
        <label>Название <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required /></label>
        <button type="submit" className="btn small">Создать (draft)</button>
      </form>
      <table className="data-table">
        <thead><tr><th>ID</th><th>Год</th><th>Название</th><th>Статус</th><th /></tr></thead>
        <tbody>
          {surveys.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td><td>{s.year}</td><td>{s.title}</td><td>{s.status}</td>
              <td><button type="button" className="btn small" onClick={() => removeSurvey(s.id)}>Удалить (superadmin)</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Импорт JSON</h2>
      <div className="form-grid">
        <label>ID опроса <input type="number" value={importSurveyId} onChange={(e) => setImportSurveyId(e.target.value)} placeholder="survey_id" /></label>
        <label>JSON <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} rows={4} /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn small" onClick={() => runImport(false)}>Preview</button>
          <button type="button" className="btn small" onClick={() => runImport(true)}>Import</button>
        </div>
        {importResult && <pre className="muted" style={{ fontSize: 12 }}>{JSON.stringify(importResult, null, 2)}</pre>}
      </div>

      <h2>Данные <button type="button" className="btn small" onClick={publishAll}>Опубликовать все скрытые</button></h2>
      <table className="data-table">
        <thead><tr><th>ID</th><th>Регион</th><th>Год</th><th>Mood</th><th>Ответов</th><th>Public</th><th /></tr></thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td>{r.region_id}</td><td>{r.year}</td><td>{r.mood_index}</td>
              <td>{r.responses_count}</td><td>{r.is_public ? 'да' : 'нет'}</td>
              <td><button type="button" className="btn small" onClick={() => togglePublic(r)}>Переключить</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
