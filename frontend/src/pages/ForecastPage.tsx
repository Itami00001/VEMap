// step12/step13 заморожены (ТЗ v1.1 §13): прогноза нет до утверждения формулы.
// Страница-заглушка с явной пометкой — без псевдо-прогноза.
export default function ForecastPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Прогноз</h1>
          <p>Раздел в разработке. <span className="muted">Прогноз заморожен до утверждения формулы Mood Index v2.0.</span></p>
        </div>
      </div>
      <div className="alert">
        Модель прогнозирования будет включена после утверждения метрик и словаря тональности
        владельцем данных (step05 → step12 → step13). Никаких демонстрационных линий без модели.
      </div>
    </div>
  )
}
