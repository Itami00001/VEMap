import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, askNewspaper, NewspaperChatError, newspaperUrl } from '../../services/api'
import type { ChatCredentials, ChatProvider, NewspaperChatMessage, NewspaperCatalog } from '../../services/api'

const NewspaperReader = lazy(() => import('./NewspaperReader'))
const ChatMarkdown = lazy(() => import('./ChatMarkdown'))
const ARCHIVE = 'archive'
const BUCHAREST_DEMO = 'bucharest-demo'
const PETROGRAD_DEMO = 'petrograd-demo'

interface NewspaperChatProps {
  open: boolean
  selection: { cityId: string; filename: string } | null
  onSelect: (selection: { cityId: string; filename: string } | null) => void
  catalog: NewspaperCatalog | null
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
  const [providerId, setProviderId] = useState('local')
  const [demo, setDemo] = useState<typeof BUCHAREST_DEMO | typeof PETROGRAD_DEMO | null>(null)
  const [keyMode, setKeyMode] = useState<string | null>(null)
  const [personalKeys, setPersonalKeys] = useState<Record<string, string>>({})
  const [folderId, setFolderId] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [issueSearch, setIssueSearch] = useState('')
  const [compactFor, setCompactFor] = useState<string | null>(null)
  const [actualModel, setActualModel] = useState<{ conversation: string; name: string } | null>(null)
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
      setProviderId((current) => items.some((item) => item.id === current && (item.available || item.accepts_personal_key))
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
  const city = catalog?.cities.find((item) => item.city_id === selection?.cityId)
  const sources = selection?.cityId === ARCHIVE ? catalog?.archive : city?.sources
  const issue = sources?.find((item) => item.id === selection?.filename)
  const provider = providers?.find((item) => item.id === providerId)
  const usePersonalKey = Boolean(provider?.accepts_personal_key && (keyMode === providerId || !provider.available))
  const apiKey = personalKeys[providerId]?.trim() ?? ''
  const folder = folderId.trim()
  const validCredentials = /^[!-~]{1,512}$/.test(apiKey) && (providerId !== 'yandex' || /^[a-z0-9]{1,64}$/.test(folder))
  const credentials = usePersonalKey && validCredentials
    ? { apiKey, folderId: providerId === 'yandex' ? folder : undefined }
    : undefined
  const readyProvider = (usePersonalKey ? Boolean(credentials) : provider?.available) ? provider : null
  const conversation = JSON.stringify([selection?.filename, providerId])
  const compact = !demo && conversation === compactFor
  const model = actualModel?.conversation === conversation ? actualModel.name : provider?.model

  return (
    <aside id="newspaper-chat" className={`newspaper-chat${open ? ' is-open' : ''}`}
      inert={!open} aria-labelledby="newspaper-chat-title"
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <header className="newspaper-chat-header">
        <ChatAvatar role="assistant" />
        <h2 id="newspaper-chat-title">{demo === PETROGRAD_DEMO ? 'Демо-поиск по архиву' : demo ? 'Демо-диалог по газете' : `Чат с ${model || 'ИИ'}`}</h2>
        <button ref={closeRef} type="button" className="nav-icon" aria-label="Закрыть чат" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      {compact && (
        <button type="button" className="btn chat-settings-button" aria-expanded={false}
          aria-controls="chat-settings" onClick={() => setCompactFor(null)}>
          <strong>Настройки</strong> · {provider?.label} · {city?.name_ru ?? 'Весь архив'} · {issue?.title}
        </button>
      )}
      <div className="newspaper-catalog" id="chat-settings" hidden={compact}>
        <label>AI-провайдер
          <select value={demo ?? providerId} onChange={(event) => {
            const chosen = event.target.value
            if (chosen === BUCHAREST_DEMO || chosen === PETROGRAD_DEMO) {
              setDemo(chosen)
            } else {
              setDemo(null)
              setProviderId(chosen)
            }
          }}>
            {!providers && <option value={providerId} disabled>Провайдеры недоступны</option>}
            {providers?.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.available && !item.accepts_personal_key}>
                {item.label}{item.available ? '' : item.accepts_personal_key ? ' · нужен личный ключ' : ` · ${item.reason ?? 'Недоступен'}`}
              </option>
            ))}
            <option value={BUCHAREST_DEMO}>Газета Бухарестъ · Ноябрь 1900 (демо)</option>
            <option value={PETROGRAD_DEMO}>Поиск газет · Петроград, март 1917 (демо)</option>
          </select>
        </label>
        {!demo && <>
          {provider?.accepts_personal_key && provider.available && (
            <button type="button" className="btn" aria-pressed={usePersonalKey}
              onClick={() => setKeyMode(usePersonalKey ? null : providerId)}>
              {usePersonalKey ? 'Переключиться на ключ VEMap' : 'Использовать свой API-ключ'}
            </button>
          )}
          {usePersonalKey && (
            <>
              <label>Личный API-ключ
                <input type="password" autoComplete="off" spellCheck={false} maxLength={512}
                  value={personalKeys[providerId] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setPersonalKeys((keys) => ({ ...keys, [providerId]: value }))
                  }} />
              </label>
              {providerId === 'yandex' && (
                <label>ID каталога Yandex Cloud
                  <input type="text" autoComplete="off" spellCheck={false} maxLength={64}
                    value={folderId} onChange={(event) => setFolderId(event.target.value)} />
                </label>
              )}
              <a href={providerId === 'yandex'
                ? 'https://yandex.cloud/ru/docs/iam/operations/authentication/manage-api-keys'
                : 'https://console.groq.com/keys'} target="_blank" rel="noreferrer">Где получить ключ</a>
              <small>Ключ действует до обновления страницы и не сохраняется на сайте.</small>
            </>
          )}
          <label>Найти город
            <input type="search" value={citySearch} onChange={(event) => setCitySearch(event.target.value)}
              placeholder="Название города" />
          </label>
          <label>Город
            <select value={selection?.cityId ?? ''} disabled={!catalog}
              onChange={(event) => {
                setIssueSearch('')
                onSelect(event.target.value ? { cityId: event.target.value, filename: '' } : null)
              }}>
              <option value="">Выберите город</option>
              <option value={ARCHIVE}>Весь архив</option>
              {catalog?.cities.filter((item) => item.city_id === selection?.cityId ||
                item.name_ru.toLowerCase().includes(citySearch.trim().toLowerCase()))
                .map((item) => <option key={item.city_id} value={item.city_id}>{item.name_ru}</option>)}
            </select>
          </label>
          {selection?.cityId === ARCHIVE && (
            <label>Найти выпуск
              <input type="search" value={issueSearch} onChange={(event) => setIssueSearch(event.target.value)}
                placeholder="Название, дата или имя PDF" />
            </label>
          )}
          <label>Газета
            <select value={selection?.filename ?? ''} disabled={!sources?.length}
              onChange={(event) => { if (selection) onSelect({ cityId: selection.cityId, filename: event.target.value }) }}>
              <option value="">Выберите выпуск</option>
              {sources?.filter((source) => selection?.cityId !== ARCHIVE || source.id === issue?.id ||
                (source.title + ' ' + source.source_pdf).toLowerCase().includes(issueSearch.trim().toLowerCase()))
                .map((source) => (
                <option key={source.id} value={source.id} disabled={!source.available}>
                  {source.title}{!source.available ? ' · PDF не найден' : source.transcript ? ' · есть расшифровка' : ''}
                </option>
              ))}
            </select>
          </label>
        </>}
      </div>
      {demo === BUCHAREST_DEMO && <ArchiveDemo key={demo} messages={bucharestConversation} sourcePdf={BUCHAREST_PDF} />}
      {demo === PETROGRAD_DEMO && <ArchiveDemo key={demo} messages={petrogradConversation} />}
      <div style={{ display: demo ? 'none' : 'contents' }}>
        {city && !city.sources.length && <p className="muted">Для этого города пока нет связанных выпусков. Откройте весь архив.</p>}
        {providersError && <p role="alert">Список провайдеров не загрузился. Откройте чат снова.</p>}
        {!providers && !providersError && <p role="status" className="muted">Проверяем настройки провайдеров…</p>}
        {provider && !provider.available && !provider.accepts_personal_key && <p className="muted">{provider.label}: {provider.reason}</p>}
        {catalogError && <p role="alert">Каталог не загрузился. Закройте чат и откройте его снова.</p>}
        {!catalog && !catalogError && <p role="status" className="muted">Загружаем каталог…</p>}
        {catalog?.archive.length === 0 && <p className="muted">В архиве пока нет выпусков.</p>}
        <ChatConversation key={conversation} open={open && !demo} sourcePdf={issue?.available ? issue.id : null}
          provider={readyProvider ?? null} credentials={credentials}
          onSend={() => setCompactFor(conversation)} onModel={(name) => setActualModel({ conversation, name })} />
      </div>
    </aside>
  )
}

const BUCHAREST_PDF = '7fd366ec-913e-56df-a9c6-5d107359d15e'
const bucharestConversation: NewspaperChatMessage[] = [
  { role: 'user', content: 'Что сообщали из Бухареста в ноябре 1900 года?' },
  {
    role: 'assistant', pages: [1, 4],
    content: 'В приложении к № 360 «Приамурских ведомостей» от 16 ноября 1900 года опубликована короткая заметка о судебных приговорах по делу о заговоре против короля Карла. По сообщению газеты, среди наказаний были десять лет тюрьмы, пожизненная каторга и совместная выплата 10 000 франков. [Дата выпуска — стр. 1](#page=1) · [Заметка — стр. 4](#page=4)',
  },
  { role: 'user', content: 'Можно ли по заметке объяснить, почему суд назначил разные наказания?' },
  {
    role: 'assistant', pages: [4],
    content: 'В заметке перечислены решения суда и фамилии осуждённых. Мотивировка приговоров и материалы дела в ней отсутствуют. Для объяснения разницы между наказаниями понадобятся судебные документы или более подробный газетный отчёт. [Стр. 4](#page=4)',
  },
]

const petrogradConversation: NewspaperChatMessage[] = [
  { role: 'user', content: 'Найди газеты о Петрограде за март 1917 года. Что тогда происходило в городе и с какого выпуска лучше начать?' },
  {
    role: 'assistant',
    content: `В архиве VEMap есть три выпуска, по которым можно проследить, как газеты описывали первые недели после Февральской революции. Даты ниже указаны так, как они напечатаны в газетах, по старому стилю.

### Что почитать

1. **«День», 8 марта.** На первой полосе автор выступает за отмену смертной казни и пишет, что такой призыв должен прозвучать в Петрограде. Это взгляд из столичной газеты на то, чего ждали от революции. [Открыть стр. 1](https://vemap.ru/api/newspapers/33e7239e-5ca2-540c-8eb8-1475f2342d34#page=1)
2. **«Приамурские ведомости», № 2543 от 14 марта.** В телеграммах из Петрограда сообщают о новой присяге на верность Российскому государству и о решении Временного правительства лишить свободы Николая II и Александру Фёдоровну. [Открыть стр. 5](https://vemap.ru/api/newspapers/e7cb12f4-048e-56d5-aeec-2d61b31dc34d#page=5)
3. **«Приамурские ведомости», № 2544 от 16 марта.** Газета сообщает, что представители Всероссийского крестьянского союза обратились одновременно к главе Временного правительства и к Петроградскому совету. [Открыть стр. 2](https://vemap.ru/api/newspapers/ac1e6a6f-ef1b-5827-b236-a2789c659de6#page=2)

### Что видно по этим выпускам

После отречения Николая II в столице действовали Временное правительство и Петроградский совет. Эти выпуски показывают, как перемены отразились в прессе: обсуждали отмену смертной казни, публиковали новую присягу и сообщали, к кому обращались общественные организации. [Историческая справка Президентской библиотеки](https://www.prlib.ru/history/619088)

**Если читать только один выпуск**, начните с [«Приамурских ведомостей» от 14 марта, стр. 5](https://vemap.ru/api/newspapers/e7cb12f4-048e-56d5-aeec-2d61b31dc34d#page=5). На одной странице видны и текст новой присяги, и новости о судьбе бывшего императора.`,
  },
]

function ArchiveDemo({ messages, sourcePdf }: { messages: NewspaperChatMessage[]; sourcePdf?: string }) {
  const [page, setPage] = useState<number | null>(null)
  return <>
    <p className="muted"><strong>Демо</strong> · Подготовленный ответ по архиву VEMap.</p>
    <ol className="newspaper-chat-history" aria-label="Демонстрационный диалог">
      {messages.map(({ role, content, pages }, index) => (
        <li key={index} className={`newspaper-chat-message ${role}`}>
          <ChatAvatar role={role} />
          {role === 'user' ? <p aria-label="Вы">{content}</p> : (
            <Suspense fallback={<p>Оформляем ответ…</p>}>
              <ChatMarkdown content={content} pages={pages} onPage={setPage} />
            </Suspense>
          )}
        </li>
      ))}
    </ol>
    {sourcePdf && page !== null && (
      <section className="chat-source-preview" aria-label="Газетная страница">
        <button className="btn" type="button" onClick={() => setPage(null)}>Закрыть PDF</button>
        <Suspense fallback={<p role="status">Загружаем просмотрщик…</p>}>
          <NewspaperReader key={page} url={newspaperUrl(sourcePdf, page)} initialPage={page} />
        </Suspense>
      </section>
    )}
    {sourcePdf && <a href={newspaperUrl(sourcePdf, 4)} target="_blank" rel="noreferrer">Открыть оригинал газеты, стр. 4 ↗</a>}
  </>
}

function ChatConversation({ open, sourcePdf, provider, credentials, onSend, onModel }: {
  open: boolean; sourcePdf: string | null; provider: ChatProvider | null
  credentials: ChatCredentials | undefined
  onSend: () => void; onModel: (model: string) => void
}) {
  const [messages, setMessages] = useState<NewspaperChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const [page, setPage] = useState<number | null>(null)
  const [error, setError] = useState<{ title: string; detail: string } | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const historyRef = useRef<HTMLOListElement>(null)
  const sentRef = useRef(false)

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
    if (!sentRef.current) {
      sentRef.current = true
      onSend()
    }
    try {
      const history = messages.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 6000) }))
      const answer = await askNewspaper(text, sourcePdf, provider.id, history, controller.signal, credentials)
      if (!controller.signal.aborted) {
        onModel(answer.model)
        setMessages([...next, { role: 'assistant', content: answer.answer, pages: answer.pages }])
      }
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
          setError({ title: 'Слишком много запросов', detail: failure instanceof NewspaperChatError ? failure.message : 'Подождите немного и отправьте вопрос снова.' })
          break
        case 503:
          setError({ title: 'Провайдер недоступен', detail: failure instanceof NewspaperChatError ? failure.message : '' })
          break
        case 422:
          setError({ title: 'Текст выпуска недоступен', detail: failure instanceof NewspaperChatError ? failure.message : '' })
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
            {messages.map(({ role, content, pages }, index) => (
              <li key={index} className={`newspaper-chat-message ${role}`}>
                <ChatAvatar role={role} />
                {role === 'user' ? <p aria-label="Вы">{content}</p> : (
                  <Suspense fallback={<p>Оформляем ответ…</p>}>
                    <ChatMarkdown content={content} pages={pages} onPage={setPage} />
                  </Suspense>
                )}
              </li>
            ))}
            {pending && <li className="muted" role="status">{provider?.id === 'local' ? 'Запрос в очереди или обрабатывается…' : 'Ожидаем ответ…'}</li>}
          </ol>
          {page !== null && (
            <section className="chat-source-preview" aria-label="Газетная страница">
              <button className="btn" type="button" onClick={() => setPage(null)}>Закрыть PDF</button>
              <Suspense fallback={<p role="status">Загружаем просмотрщик…</p>}>
                <NewspaperReader key={page} url={newspaperUrl(sourcePdf, page)} initialPage={page} />
              </Suspense>
            </section>
          )}
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
