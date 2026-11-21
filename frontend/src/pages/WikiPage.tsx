import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { wiki } from '../services/wiki'
import type { WikiSummary } from '../services/wiki'

const publishedDate = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeZone: 'Europe/Moscow' })

function PublicationTile({ article }: { article: WikiSummary }) {
  return (
    <Link to={`/wiki/${article.id}`} className="wiki-tile">
      <time dateTime={article.date}>{publishedDate.format(new Date(article.date))}</time>
      <h2>{article.title}</h2>
      <p>{article.summary}</p>
      <footer><span>PDF · {article.file_count}</span><span>{article.processing === 'ready' ? `Точек · ${article.point_count}` : 'Карта готовится'}</span></footer>
    </Link>
  )
}

function ArticleForm({ onClose, onSent }: { onClose: () => void; onSent: (id: string) => void }) {
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const request = useRef<AbortController | null>(null)
  const submissionId = useRef<string | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current) return
    setProblem('')
    if (files.length < 1 || files.length > 3) {
      setProblem('Прикрепите от 1 до 3 газет в PDF.')
      return
    }
    if (files.some((file) => file.size > 24 * 1024 * 1024) || files.reduce((size, file) => size + file.size, 0) > 36 * 1024 * 1024) {
      setProblem('Лимит — 24 МБ на один PDF и 36 МБ суммарно.')
      return
    }
    const form = new FormData(event.currentTarget)
    const controller = new AbortController()
    request.current = controller
    submissionId.current ??= crypto.randomUUID()
    setWorking(true)
    try {
      const { id } = await wiki.submit(form, submissionId.current, controller.signal)
      if (!controller.signal.aborted) onSent(id)
    } catch (error) {
      if (!controller.signal.aborted) setProblem(error instanceof Error ? error.message : 'Не удалось отправить статью.')
    } finally {
      if (!controller.signal.aborted) setWorking(false)
      request.current = null
    }
  }

  return (
    <form className="wiki-compose" onSubmit={submit}>
      <h2>Новая статья</h2>
      <fieldset disabled={working}>
        <label>Название<input name="title" type="text" maxLength={180} required /></label>
        <label>Текст<textarea name="body" rows={7} maxLength={10000} required /></label>
        <label className="wiki-upload">
          Газеты в PDF
          <input name="files" type="file" accept="application/pdf,.pdf" multiple required
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          <small>До 3 файлов · 24 МБ на файл · 36 МБ всего</small>
        </label>
        {files.length > 0 && <ul className="wiki-file-selection">{files.map((file, index) => <li key={index}>{file.name}</li>)}</ul>}
        <p className="muted">Файлы, текст и сведения о браузере получит закрытая группа модераторов. Одобренные статья и PDF будут общедоступны.</p>
        {problem && <p className="alert error" role="alert">{problem}</p>}
        <div className="wiki-actions">
          <button type="submit" className="btn primary">{working ? 'Отправляем…' : 'Отправить на рассмотрение'}</button>
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
        </div>
      </fieldset>
    </form>
  )
}

export default function WikiPage() {
  const [catalogue, setCatalogue] = useState<Awaited<ReturnType<typeof wiki.list>> | null>(null)
  const [failure, setFailure] = useState(false)
  const [creating, setCreating] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [before, setBefore] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    wiki.list(controller.signal, before).then((data) => {
      if (!controller.signal.aborted) {
        setCatalogue((previous) => ({ ...data, articles: before && previous
          ? [...previous.articles, ...data.articles.filter((article) => !previous.articles.some((item) => item.id === article.id))]
          : data.articles }))
        setFailure(false)
      }
    }).catch(() => { if (!controller.signal.aborted) setFailure(true) })
    return () => controller.abort()
  }, [reload, before])

  return (
    <div className="page wiki-page">
      <header className="wiki-header">
        <div><h1>VEMap Wiki</h1><p>Газеты и карты, собранные читателями архива.</p></div>
        <button className="btn primary" type="button" disabled={!catalogue?.accepting || creating}
          onClick={() => { setReceipt(null); setCreating(true) }}>Создать статью</button>
      </header>
      {receipt && <div className="wiki-receipt" role="status">
        <strong>Статья отправлена на рассмотрение.</strong>
        <span>ID статьи <code>{receipt}</code></span>
      </div>}
      {creating && <ArticleForm onClose={() => setCreating(false)} onSent={(id) => {
        setReceipt(id)
        setCreating(false)
        setBefore(null)
        setReload((version) => version + 1)
      }} />}
      {failure && <p className="alert error" role="alert">Не удалось загрузить публикации. <button className="btn" type="button"
        onClick={() => setReload((version) => version + 1)}>Повторить</button></p>}
      {!catalogue && !failure && <p role="status">Загружаем публикации…</p>}
      {catalogue && !catalogue.accepting && <p className="muted" role="status">
        {catalogue.paused ? 'Приём заявок приостановлен до решения модератора.' : 'Приём новых статей временно недоступен.'}
      </p>}
      {catalogue?.articles.length === 0 && <div className="wiki-empty"><h2>Публикаций пока нет</h2></div>}
      {catalogue && catalogue.articles.length > 0 && <div className="wiki-grid" aria-label="Опубликованные статьи">
        {catalogue.articles.map((article) => <PublicationTile key={article.id} article={article} />)}
      </div>}
      {catalogue?.next && <button type="button" className="btn wiki-more" disabled={before === catalogue.next}
        onClick={() => setBefore(catalogue.next)}>{before === catalogue.next ? 'Загружаем…' : 'Ещё статьи'}</button>}
    </div>
  )
}
