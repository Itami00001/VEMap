import { Link } from 'react-router-dom'

import { atlasArt } from '../features/atlasArt'
const archiveCover = import.meta.env.BASE_URL + 'archive-issue-1900.jpg'
const features = [
  { to: '/compare', title: 'Сравнить периоды', description: 'Посмотрите, как менялся тон публикаций о том же месте.',
    action: 'Открыть сравнение', art: 'compare.webp' },
  { to: '/archive', title: 'Открыть первоисточник', description: 'Перейдите от данных на карте к странице газетного выпуска.',
    action: 'Посмотреть архив', art: 'reader.webp' },
  { to: '/wiki', title: 'Пополнить архив', description: 'Загрузите выпуск и предложите его для публикации в Вики.',
    action: 'Открыть VEMap Wiki', art: 'folder.webp' },
]

export default function Landing() {
  return <div className="page atlas-page atlas-home">
    <section className="atlas-home-hero" aria-labelledby="atlas-home-title">
      <div className="atlas-page-heading">
        <h1 id="atlas-home-title">Карта настроений народов России</h1>
        <p>Исследуйте тональность исторических газет о городах и регионах России. Выберите период, сравните публикации и откройте страницы первоисточников.</p>
        <div className="atlas-home-actions">
          <Link className="btn primary" to="/map">Открыть карту <span aria-hidden="true">→</span></Link>
          <Link to="/archive">Читать архив</Link>
        </div>
      </div>
      <div className="atlas-home-preview">
        <img className="atlas-home-map" src={atlasArt('map-feb1900.png')} alt="Карта настроений VEMap за февраль 1900 года" />
        <Link className="atlas-home-date" to="/map?period=1900-02">Февраль 1900 <span aria-hidden="true">↗</span></Link>
        <Link className="atlas-home-folio" to="/archive?issue=leaf_19000124_0001_searchable.pdf">
          <img src={archiveCover} alt="Первая страница газеты «Петербургский листок»" />
          <span>Из архива · «Петербургский листок»</span>
        </Link>
      </div>
    </section>
    <section className="atlas-home-features" aria-label="Работа с архивом">
      {features.map((feature) => <Link to={feature.to} key={feature.to} className="atlas-feature">
        <div>
          <h2>{feature.title}</h2>
          <p>{feature.description}</p>
          <strong>{feature.action} <span aria-hidden="true">↗</span></strong>
        </div>
        <img src={atlasArt(feature.art)} alt="" />
      </Link>)}
    </section>
    <section className="atlas-about-steps" aria-labelledby="atlas-home-method">
      <article style={{ gridColumn: '1 / -1' }}>
        <div>
          <h2 id="atlas-home-method">Что показывает карта настроений</h2>
          <p>Цвет на карте показывает тон газетных материалов о выбранном месте за доступный период. Индекс рассчитывается по архивной выборке, поэтому он отражает то, как события описывала пресса.</p>
          <Link to="/about">Как устроен VEMap</Link>
        </div>
      </article>
    </section>
  </div>
}
