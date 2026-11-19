import { Link } from 'react-router-dom'
import { newspaperUrl } from '../services/api'

const sections = [
  { to: '/map', title: 'Карта', detail: 'Выбирайте город и период, открывайте газетные страницы.' },
  { to: '/data', title: 'Данные', detail: 'Просматривайте оценки и объём материалов по городам.' },
  { to: '/forecast', title: 'Прогнозирование', detail: 'Узнайте, как проект готовится к построению прогнозов.' },
]

const pipeline = [
  { title: 'Газетный выпуск', text: 'Архивная копия хранится в PDF. У распознанного фрагмента сохраняются имя файла и номер страницы, чтобы к скану можно было вернуться из сводки.' },
  { title: 'Город и время', text: 'Подготовленные данные связывают фрагменты с городами и датами. Публикации группируются по городу и месяцу. Опросы могут быть представлены отдельными годовыми периодами.' },
  { title: 'Оценка тональности', text: 'Импорт переводит среднюю тональность фрагментов в шкалу 0–100 или сохраняет готовую нормализованную оценку. В таблице рядом можно посмотреть объём материалов.' },
  { title: 'Карта и проверка', text: 'Цвет маркера показывает оценку за выбранный период. Из карточки города можно открыть нужную страницу выпуска и задать вопрос по её контексту.' },
]

const features = [
  { icon: '/map', title: 'Исторические границы', text: 'На карте дата наблюдений и дата географической подложки могут различаться. Если для периода есть исторический снимок границ, его дата указана под картой.', to: '/map', link: 'Перейти к карте' },
  { icon: '/data', title: 'Mood Index', text: 'Шкала от 0 до 100 показывает тональность в выборке. В «Сравнении» видны оценки, объём материала и методика каждого периода. Изменение в пунктах доступно для сопоставимых наблюдений.', to: '/compare', link: 'Сравнить периоды' },
  { icon: 'chat', title: 'Чат с ИИ по выпуску', text: 'Откройте выпуск на карте или найдите его в каталоге чата. Спросите, какие события описаны в тексте. Если в ответе есть ссылка на страницу, по ней можно открыть скан.', to: '/map', link: 'Найти выпуск на карте' },
]

const technologies = [
  ['React и TypeScript', 'Интерфейс карты, таблиц и архива.'],
  ['MapLibre GL и GeoJSON', 'Границы, маркеры и кластеризация.'],
  ['FastAPI и PostgreSQL', 'Импорт CSV, хранение оценок и выдача источников.'],
  ['PDF.js и pypdf', 'Просмотр сканов и извлечение распознанного текста.'],
  ['Groq, Yandex AI Studio и Google AI Studio', 'Ответы по выбранному выпуску через выбранного провайдера.'],
  ['Docker Compose и Nginx', 'Сборка и запуск сервисов.'],
]

const limits = [
  ['Покрытие архива неравномерно', 'Для одних городов есть много фрагментов, для других — один или ни одного. Mood Index описывает содержание выборки. При сравнении учитывайте объём материала и методику расчёта.'],
  ['Распознавание может ошибаться', 'Качество скана, дореформенная орфография и арабская графика влияют на OCR. Сверяйте цитаты, даты и имена по газетной странице.'],
  ['У границ есть собственная дата', 'Исторические подложки доступны для отдельных дат. Дата и источник административных контуров указаны под картой.'],
  ['Прогнозирование в разработке', 'Для прогноза нужны сопоставимые наблюдения за достаточно длинный срок и проверка качества модели. В разделе описана подготовка к этому этапу.'],
]

const featuredIssue = 'leaf_19000124_0001_searchable.pdf'

function SectionIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path === '/map' && <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15" /></>}
      {path === '/data' && <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11m-6-5h18" /></>}
      {path === '/forecast' && <path d="M3 4v16h18M6 15l5-5 4 3 5-6m-4 0h4v4" />}
      {path === 'chat' && <path d="M20 5H4v12h4v4l5-4h7ZM8 10h8m-8 3h5" />}
    </svg>
  )
}

export default function Landing() {
  return (
    <div className="archive-home">
      <section className="archive-intro">
        <div className="archive-copy">
          <p className="archive-kicker">Историческая пресса на карте</p>
          <h1>Города на страницах газет</h1>
          <p>VEMap связывает газетные материалы с городами и периодами. Посмотрите, как менялась тональность публикаций, и откройте страницу выпуска, чтобы увидеть контекст.</p>
          <div className="archive-actions">
            {sections.map(({ to, title }, index) => (
              <Link key={to} className={index === 0 ? 'btn primary' : 'btn'} to={to}>
                <SectionIcon path={to} />{title}
              </Link>
            ))}
          </div>
        </div>
        <div className="archive-example">
          <p className="archive-kicker">Как начать</p>
          <ol>
            <li><b>Выберите период</b><span>Начните с материалов за 1900 год.</span></li>
            <li><b>Найдите город</b><span>Откройте сводку и перейдите к странице газеты.</span></li>
            <li><b>Задайте вопрос по выпуску</b><span>Уточните, о каких событиях или местах говорится в тексте.</span></li>
          </ol>
        </div>
      </section>

      <section className="archive-sections" aria-labelledby="archive-sections-title">
        <h2 id="archive-sections-title">Исследуйте архив</h2>
        <div className="archive-section-grid">
          {sections.map(({ to, title, detail }) => (
            <Link className="archive-section-link" key={to} to={to}>
              <SectionIcon path={to} /><strong>{title}</strong><span>{detail}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="archive-sections" aria-labelledby="archive-pipeline-title">
        <h2 id="archive-pipeline-title">От газетной страницы до карты</h2>
        <ol className="archive-pipeline">
          {pipeline.map(({ title, text }) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}
        </ol>
      </section>

      <section className="archive-spotlight" aria-labelledby="archive-spotlight-title">
        <div className="archive-reveal">
          <p className="archive-kicker">Из коллекции VEMap</p>
          <h2 id="archive-spotlight-title">Первая полоса, 1900 год</h2>
          <p>На одной странице «Петербургского листка» соседствуют сообщения из Варшавы и новости из Южной Африки. Откройте выпуск, чтобы увидеть, в каком контексте газета упоминает эти места.</p>
          <a className="btn" href={newspaperUrl(featuredIssue, 1)} target="_blank" rel="noreferrer">
            Открыть первую страницу PDF
          </a>
        </div>
        <figure className="archive-folio">
          <img src="/archive-issue-1900.jpg" alt="Первая полоса газеты «Петербургский листок» с заголовком и колонками набора"
            width={582} height={820} loading="lazy" decoding="async" />
          <figcaption>«Петербургский листок», № 23, 24 января (5 февраля) 1900 года</figcaption>
        </figure>
      </section>

      <section className="archive-editorial" aria-labelledby="archive-features-title">
        <h2 id="archive-features-title">Что можно исследовать</h2>
        {features.map(({ icon, title, text, to, link }) => (
          <article className="archive-feature archive-reveal" key={title}>
            <div className="archive-feature-title"><SectionIcon path={icon} /><h3>{title}</h3></div>
            <div><p>{text}</p><Link to={to}>{link} <span aria-hidden="true">↗</span></Link></div>
          </article>
        ))}
      </section>

      <section className="archive-reading" aria-labelledby="archive-limits-title">
        <h2 id="archive-limits-title">Как читать данные проекта</h2>
        {limits.map(([title, text]) => (
          <details key={title}><summary>{title}</summary><p>{text}</p></details>
        ))}
        <Link className="archive-more" to="/about">Подробнее о методике и источниках</Link>
      </section>

      <section className="archive-stack" aria-labelledby="archive-tech-title">
        <h2 id="archive-tech-title">На чём работает VEMap</h2>
        <dl>{technologies.map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text}</dd></div>)}</dl>
      </section>
    </div>
  )
}
