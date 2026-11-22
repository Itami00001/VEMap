import { Link } from 'react-router-dom'
import { atlasArt } from '../features/atlasArt'
import { moodLegend } from '../features/map/legend'

const steps = [
  ['Оцифровка', 'Распознаём текст архивных газет. За фрагментом сохраняется ссылка на страницу PDF.', 'folder.webp'],
  ['Анализ текста', 'Связываем публикации с городами и датами и оцениваем тональность распознанных фрагментов.', 'reader.webp'],
  ['Карта настроений', 'Показываем оценки за доступные периоды. Из карточки города можно открыть оригинал.', 'compare.webp'],
]

export default function AboutPage() {
  return (
    <div className="page atlas-page atlas-about">
      <section className="atlas-about-intro">
        <div className="atlas-page-heading">
          <h1>О проекте VEMap</h1>
          <p>Оцифровываем исторические газеты и наносим тон публикаций на карту.</p>
          <Link to="/map" className="btn primary">Открыть карту</Link>
        </div>
        <div className="atlas-about-art" aria-hidden="true">
          <img src={atlasArt('compare.webp')} alt="" />
          <img src={atlasArt('reader.webp')} alt="" />
        </div>
      </section>
      <section className="atlas-about-steps" aria-label="Как устроен VEMap">
        {steps.map(([title, description, art]) => <article key={title}>
          <img src={atlasArt(art)} alt="" />
          <div><h2>{title}</h2><p>{description}</p></div>
        </article>)}
      </section>
      <section className="atlas-about-index">
        <h2>Как читать индекс</h2>
        <div>
          <div className="legend-scale">{moodLegend().map((item) => <span key={item.label} style={{ background: item.color }} />)}</div>
          <div className="legend-labels"><span>0</span><span>50</span><span>100</span></div>
        </div>
        <p>Индекс описывает тон материалов в выборке. При сравнении учитывайте её объём, методику расчёта и качество распознавания.</p>
      </section>
      <section className="atlas-about-details">
        <details><summary>Как работает чат по выпуску</summary>
          <p>Модель отвечает по подобранным фрагментам выбранного PDF. По ссылкам в ответе можно открыть страницы и сверить вывод.</p>
        </details>
        <details><summary>Границы и даты</summary>
          <p>Карта использует доступные исторические слои. Источники геометрии и пояснения доступны в разделе «Легенда» на карте.</p>
        </details>
      </section>
    </div>
  )
}
