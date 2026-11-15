import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, askNewspaper, NewspaperChatError } from '../../services/api'
import type { ChatProvider, NewspaperChatMessage, NewspaperCity } from '../../services/api'

interface NewspaperChatProps {
  open: boolean
  selection: { cityId: string; filename: string } | null
  onSelect: (selection: { cityId: string; filename: string } | null) => void
  catalog: NewspaperCity[] | null
  catalogError: boolean
  onClose: () => void
}

function ChatAvatar({ role }: { role: NewspaperChatMessage['role'] }) {
  return (
    <span className={`newspaper-chat-avatar ${role}`} aria-hidden="true">
      {role === 'assistant' ? 'ИИ' : 'Вы'}
    </span>
  )
}

export default function NewspaperChat({ open, selection, onSelect, catalog, catalogError, onClose }: NewspaperChatProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [providers, setProviders] = useState<ChatProvider[] | null>(null)
  const [providersError, setProvidersError] = useState(false)
  const [providerId, setProviderId] = useState('groq')
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setProvidersError(false)
    api.getChatProviders(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setProviders(items)
      setProviderId((current) => items.some((item) => item.id === current && item.available)
        ? current
        : items.find((item) => item.available)?.id ?? items[0]?.id ?? '')
    }).catch(() => {
      if (!controller.signal.aborted) {
        setProviders(null)
        setProvidersError(true)
      }
    })
    return () => controller.abort()
  }, [open])
  const city = catalog?.find((item) => item.city_id === selection?.cityId)
  const provider = providers?.find((item) => item.id === providerId)

  return (
    <aside id="newspaper-chat" className={`newspaper-chat${open ? ' is-open' : ''}`}
      inert={!open} aria-labelledby="newspaper-chat-title"
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <header className="newspaper-chat-header">
        <ChatAvatar role="assistant" />
        <h2 id="newspaper-chat-title">Чат с ИИ</h2>
        <button ref={closeRef} type="button" className="nav-icon" aria-label="Закрыть чат" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="newspaper-catalog">
        <label>AI-провайдер
          <select value={providerId} disabled={!providers?.some((item) => item.available)}
            onChange={(event) => setProviderId(event.target.value)}>
            {!providers && <option value={providerId}>Провайдеры недоступны</option>}
            {providers?.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.available}>
                {item.label}{item.available ? '' : ` · ${item.reason ?? 'Недоступен'}`}
              </option>
            ))}
          </select>
        </label>
        <label>Город
          <select value={selection?.cityId ?? ''} disabled={!catalog?.length}
            onChange={(event) => onSelect(event.target.value ? { cityId: event.target.value, filename: '' } : null)}>
            <option value="">Выберите город</option>
            {catalog?.map((item) => <option key={item.city_id} value={item.city_id}>{item.name_ru}</option>)}
          </select>
        </label>
        <label>Газета
          <select value={selection?.filename ?? ''} disabled={!city?.sources.length}
            onChange={(event) => { if (city) onSelect({ cityId: city.city_id, filename: event.target.value }) }}>
            <option value="">Выберите выпуск</option>
            {city?.sources.map((source) => <option key={source.source_pdf} value={source.source_pdf}>{source.source_pdf}</option>)}
          </select>
        </label>
      </div>
      {providersError && <p role="alert">Список провайдеров не загрузился. Откройте чат снова.</p>}
      {!providers && !providersError && <p role="status" className="muted">Проверяем настройки провайдеров…</p>}
      {provider && !provider.available && <p className="muted">{provider.label}: {provider.reason}</p>}
      {catalogError && <p role="alert">Каталог не загрузился. Закройте чат и откройте его снова.</p>}
      {!catalog && !catalogError && <p role="status" className="muted">Загружаем каталог…</p>}
      {catalog?.length === 0 && <p className="muted">В архиве пока нет доступных выпусков.</p>}
      <ChatConversation key={JSON.stringify([selection?.filename, providerId])}
        open={open} sourcePdf={selection?.filename || null} provider={provider?.available ? provider : null} />
    </aside>
  )
}

function ChatConversation({ open, sourcePdf, provider }: {
  open: boolean; sourcePdf: string | null; provider: ChatProvider | null
}) {
  const [messages, setMessages] = useState<NewspaperChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ title: string; detail: string } | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const historyRef = useRef<HTMLOListElement>(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  useEffect(() => {
    const history = historyRef.current
    if (open && history) history.scrollTop = history.scrollHeight
  }, [messages, open, pending])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!sourcePdf || !provider || !text || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setPending(true)
    setError(null)
    setQuestion('')
    const next: NewspaperChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    try {
      const history = messages.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 6000) }))
      const answer = await askNewspaper(text, sourcePdf, provider.id, history, controller.signal)
      if (!controller.signal.aborted) setMessages([...next, { role: 'assistant', content: answer }])
    } catch (failure) {
      if (controller.signal.aborted) return
      setMessages(messages)
      setQuestion(text)
      const status = failure instanceof NewspaperChatError ? failure.status : null
      switch (status) {
        case 402:
          setError({ title: 'Проверьте баланс', detail: failure instanceof NewspaperChatError ? failure.message : '' })
          break
        case 429:
          setError({ title: 'Слишком много запросов', detail: 'Подождите немного и отправьте вопрос снова.' })
          break
        case 503:
          setError({ title: 'Провайдер недоступен', detail: failure instanceof NewspaperChatError ? failure.message : '' })
          break
        default:
          setError({
            title: 'Чат не ответил',
            detail: failure instanceof NewspaperChatError ? failure.message : 'Проверьте подключение и отправьте вопрос снова.',
          })
      }
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null
        setPending(false)
      }
    }
  }

  return (
    <>
      {sourcePdf ? (
        <>
          <ol ref={historyRef} className="newspaper-chat-history" aria-label="История сообщений" role="log">
            {messages.map(({ role, content }, index) => (
              <li key={index} className={`newspaper-chat-message ${role}`}>
                <ChatAvatar role={role} />
                <p aria-label={role === 'user' ? 'Вы' : 'ИИ'}>{content}</p>
              </li>
            ))}
            {pending && <li className="muted">Ожидаем ответ…</li>}
          </ol>
          {error && <div className="alert error" role="alert"><strong>{error.title}</strong><br />{error.detail}</div>}
          <form className="newspaper-chat-form" onSubmit={submit}>
            <label htmlFor="newspaper-question">Вопрос о выпуске</label>
            <div className="newspaper-chat-composer">
              <textarea id="newspaper-question" rows={3} maxLength={2000} value={question} disabled={pending || !provider}
                onChange={(event) => setQuestion(event.target.value)} />
              <button type="submit" className="nav-icon nav-icon-chat" aria-label="Отправить"
                title="Отправить" disabled={pending || !provider || !question.trim()}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="newspaper-chat-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="12" y="8" width="24" height="32" rx="4" />
            <path d="M18 17h12m-12 7h12m-12 7h7" />
          </svg>
          <p>Выберите город и выпуск здесь или откройте газету на карте.</p>
        </div>
      )}
    </>
  )
}
