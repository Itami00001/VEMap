import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <h1>MAP MOOD</h1>
          <p className="tagline">Настроения городов — на карте, во времени, с прогнозом</p>
          <div className="hero-actions">
            <Link className="btn" to="/map">Карта настроений</Link>
            <Link className="btn" to="/data">Данные</Link>
            <Link className="btn" to="/forecast">Прогноз</Link>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Что такое Map Mood</h2>
        <p className="section-sub muted">Данные → анализ → визуализация → прогноз</p>
        <div className="pipeline">
          <div className="step"><b>Данные</b><span>газеты, опросы</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>Анализ</b><span>NLP, Mood Index</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>Карта</b><span>города и регионы</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>Прогноз</b><span>тренд</span></div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Сканы газет → AI-анализ</h2>
        <p className="section-sub muted">Исторические газеты — ядро данных (ТЗ v1.1)</p>
        <div className="pipeline">
          <div className="step"><b>Сканы</b><span>архивы газет</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>Распознавание</b><span>текст статей</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>NLP-метрики</b><span>тональность, темы</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>Mood Index</b><span>0–100</span></div>
          <span className="arrow">→</span>
          <div className="step"><b>Карта</b><span>периоды</span></div>
        </div>
      </section>

      <section className="landing-section">
        <div className="action-cards">
          <Link className="action-card" to="/map"><span className="icon">🗺</span><b>Карта</b><span>Mood Index по регионам и городам</span></Link>
          <Link className="action-card" to="/data"><span className="icon">📊</span><b>Данные</b><span>Публичная таблица по городам</span></Link>
          <Link className="action-card" to="/forecast"><span className="icon">🔮</span><b>Прогноз</b><span>Раздел в разработке</span></Link>
        </div>
      </section>

      <section className="landing-section">
        <h2>Как это работает</h2>
        <div className="steps-grid">
          <div className="step-card"><b>Данные</b><span>Собираем тексты и ответы</span></div>
          <div className="step-card"><b>Анализ</b><span>Считаем Mood Index 0–100</span></div>
          <div className="step-card"><b>Регионы</b><span>Привязываем к городам и карте</span></div>
          <div className="step-card"><b>Время</b><span>Смотрим динамику по периодам</span></div>
          <div className="step-card"><b>Прогноз</b><span>Оцениваем тренд с проверкой качества</span></div>
        </div>
      </section>

      <section className="landing-section">
        <h2>О проекте / цель</h2>
        <p className="section-sub muted">
          Map Mood отвечает на три вопроса: каково состояние настроений, как оно изменилось
          и что может быть дальше. Сейчас фронт работает на DEMO-данных; формула Mood Index v2.0
          и прогноз заморожены до утверждения методики владельцем данных.
        </p>
      </section>

      <section className="landing-section">
        <h2>Команда</h2>
        <div className="team-grid">
          <div className="team-card"><span className="avatar">Ф</span><b>Фронтенд</b><span>Карта, таблицы, сравнение</span></div>
          <div className="team-card"><span className="avatar">С</span><b>Саня · данные</b><span>Газеты, метрики, БД</span></div>
          <div className="team-card"><span className="avatar">М</span><b>Миша · аналитика</b><span>AI-анализ, темы</span></div>
        </div>
      </section>
    </div>
  )
}
