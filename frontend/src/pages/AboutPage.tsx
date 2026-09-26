export default function AboutPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>О проекте</h1>
          <p>
            VEMap — интерактивная аналитическая платформа: изменение общественных
            настроений по городам и регионам во времени.
          </p>
        </div>
      </div>
      <section className="landing-section">
        <h2>Источники данных</h2>
        <p className="section-sub muted">
          Ядро — исторические газеты (тональность текстов, NLP baseline — словарный подход).
          Опросы и Telegram-бот — вторичный источник.
        </p>
      </section>
      <section className="landing-section">
        <h2>Шкала</h2>
        <p className="section-sub muted">
          Mood Index в БД — строго 0–100. Входные коэффициенты 0–1 / 0–10 нормализуются на входе.
          Формула v2.0 утверждается владельцем данных.
        </p>
      </section>
    </div>
  )
}
