import { Link } from 'react-router-dom'

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
  { icon: '/map', title: 'Исторические границы', text: 'Географический фон меняется там, где есть подходящий снимок границ. Период в ползунке задаёт дату наблюдений. Под картой указаны источники современных спорных контуров.' },
  { icon: '/data', title: 'Mood Index', text: 'Шкала от 0 до 100 помогает сопоставлять тональность материалов. Серый маркер показывает город без оценки, а при отдалении близкие города объединяются в кластеры.' },
  { icon: 'chat', title: 'Чат с ИИ по выпуску', text: 'Выберите город и газету в чате или откройте источник на карте. Для длинного выпуска приложение подбирает страницы по словам вопроса и передаёт их модели с номерами.' },
]

const technologies = [
  ['React и TypeScript', 'Интерфейс карты, таблиц и архива.'],
  ['MapLibre GL и GeoJSON', 'Границы, маркеры и кластеризация.'],
  ['FastAPI и PostgreSQL', 'Импорт CSV, хранение оценок и выдача источников.'],
  ['PDF.js и pypdf', 'Просмотр сканов и извлечение распознанного текста.'],
  ['Groq, Yandex AI Studio и Google AI Studio', 'Ответы по выбранному выпуску через выбранного провайдера.'],
  ['Docker Compose и Nginx', 'Сборка и запуск сервисов.'],
]

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

      <section className="archive-sections" aria-labelledby="archive-features-title">
        <h2 id="archive-features-title">Что можно исследовать</h2>
        <div className="archive-section-grid">
          {features.map(({ icon, title, text }) => (
            <article className="archive-section-link" key={title}>
              <SectionIcon path={icon} /><h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="archive-sections" aria-labelledby="archive-tech-title">
        <h2 id="archive-tech-title">На чём работает VEMap</h2>
        <dl className="archive-tech">
          {technologies.map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text}</dd></div>)}
        </dl>
      </section>

      <section className="archive-sections" aria-labelledby="archive-limits-title">
        <h2 id="archive-limits-title">Как читать данные проекта</h2>
        <div className="archive-method">
          <div><h3>Покрытие архива неравномерно</h3><p>Для одних городов есть много фрагментов, для других — один или ни одного. Mood Index характеризует содержание выборки и зависит от её состава. Сравнивая периоды, учитывайте объём материала и методику расчёта.</p></div>
          <div><h3>Скан остаётся первоисточником</h3><p>Дореформенная орфография и плохое качество сканов снижают точность OCR. Чат может пропустить детали или ошибиться в толковании. Проверяйте цитаты, даты и имена по газетной странице.</p></div>
          <div><h3>География зависит от доступных снимков</h3><p>Историческая подложка есть для отдельных дат. Административные контуры имеют свою датировку и источник. Линия фактического контроля не отображается.</p></div>
          <div><h3>Прогнозирование в разработке</h3><p>Для прогноза нужны сопоставимые наблюдения за достаточно длинный срок и проверка качества модели. Пока раздел описывает подготовку к этому этапу.</p></div>
        </div>
        <Link className="archive-more" to="/about">Подробнее о методике и источниках</Link>
      </section>
    </div>
  )
}
