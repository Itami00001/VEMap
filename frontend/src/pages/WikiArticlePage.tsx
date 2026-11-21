import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LngLatBounds } from 'maplibre-gl'
import type { Map as LibreMap } from 'maplibre-gl'
import MapView, { BoundaryNote } from '../features/map/MapView'
import { sentimentColor } from '../features/map/color'
import { wiki } from '../services/wiki'
import type { WikiArticle, WikiPoint } from '../services/wiki'

const EMPTY_VALUES = {}

function PublicationMap({ points, map, onMapReady, selected, onSelect }: {
  points: WikiPoint[]; map: LibreMap | null; onMapReady: (map: LibreMap) => void
  selected: number; onSelect: (index: number) => void
}) {
  const initial = useMemo<[number, number]>(() => [points[0].lon, points[0].lat], [points])
  useEffect(() => {
    if (!map) return
    const bounds = new LngLatBounds(initial, initial)
    const features = points.map((point, index) => {
      bounds.extend([point.lon, point.lat])
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
        properties: { index, color: point.mood_index == null ? '#67c2dc' : sentimentColor(point.mood_index / 100) },
      }
    })
    const sourceId = 'wiki-publication'
    const layerId = 'wiki-publication-points'
    map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {
      'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#e8f2fa',
    } })
    const listener = map.on('click', layerId, (event) => {
      const index = event.features?.[0]?.properties.index
      if (typeof index === 'number') onSelect(index)
    })
    if (bounds.getWest() === bounds.getEast() && bounds.getSouth() === bounds.getNorth()) {
      map.jumpTo({ center: initial, zoom: 6 })
    } else {
      map.fitBounds(bounds, { padding: 48, maxZoom: 7, duration: 0 })
    }
    return () => {
      listener.unsubscribe()
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [map, initial, points, onSelect])

  useEffect(() => {
    if (!map?.getLayer('wiki-publication-points')) return
    map.setPaintProperty('wiki-publication-points', 'circle-stroke-width',
      ['case', ['==', ['get', 'index'], selected], 4, 2])
  }, [map, points, selected])

  return <div className="map-shell wiki-map"><MapView values={EMPTY_VALUES} initialCenter={initial} onMapReady={onMapReady} /></div>
}

const processingLabel = {
  waiting: 'Газеты ожидают обработки.',
  queued: 'Газеты в очереди на обработку.',
  running: 'Газеты обрабатываются.',
  failed: 'Не удалось получить CSV. Модератор может повторить обработку.',
  ready: 'В CSV нет точек с координатами.',
}

function Article({ article }: { article: WikiArticle }) {
  const [map, setMap] = useState<LibreMap | null>(null)
  const [selected, setSelected] = useState(0)
  const point = article.points[selected]
  const selectPoint = (index: number) => {
    setSelected(index)
    const item = article.points[index]
    map?.easeTo({ center: [item.lon, item.lat], zoom: Math.max(map.getZoom(), 5) })
  }
  return (
    <>
      <header className="wiki-header"><div><h1>{article.title}</h1></div></header>
      <div className="wiki-article-text">{article.body}</div>
      <section className="wiki-section">
        <h2>Газетные выпуски</h2>
        <ul className="wiki-sources">{article.files.map((file, index) => <li key={index}>
          <a href={wiki.pdf(article.id, index)} target="_blank" rel="noreferrer">{file.name}</a>
        </li>)}</ul>
      </section>
      <section className="wiki-section">
        <div className="wiki-section-heading"><h2>Карта статьи</h2>
          {article.processing === 'ready' && <a href={wiki.csv(article.id)} className="btn">Скачать CSV</a>}
        </div>
        {point ? <>
          <PublicationMap points={article.points} map={map} onMapReady={setMap} selected={selected} onSelect={setSelected} />
          <BoundaryNote />
          <div className="wiki-point-details">
            <label>Точка на карте
              <select value={selected} onChange={(event) => selectPoint(Number(event.target.value))}>
                {article.points.map((item, index) => <option key={index} value={index}>
                  {item.name || `${item.lat.toFixed(3)}, ${item.lon.toFixed(3)}`}
                </option>)}
              </select>
            </label>
            {point.mood_index !== null && <span>Mood Index · {point.mood_index}</span>}
            {point.file_index !== null && <a href={wiki.pdf(article.id, point.file_index, point.page)} target="_blank" rel="noreferrer">
              {point.page ? `Открыть PDF, стр. ${point.page}` : 'Открыть PDF'}
            </a>}
          </div>
        </> : <p className="muted" role="status">{processingLabel[article.processing]}</p>}
      </section>
    </>
  )
}

export default function WikiArticlePage() {
  const { id = '' } = useParams()
  const [result, setResult] = useState<{ id: string; article?: WikiArticle; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => wiki.get(id, controller.signal).then((article) => {
      if (controller.signal.aborted) return
      setResult({ id, article })
      if (article.processing === 'queued' || article.processing === 'running') timer = setTimeout(refresh, 5000)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ id, error: error instanceof Error ? error.message : 'Статья недоступна.' })
    })
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [id])
  const current = result?.id === id ? result : null
  return (
    <div className="page wiki-page wiki-detail-page">
      <Link className="wiki-back" to="/wiki">← К публикациям</Link>
      {current?.article && <Article key={id} article={current.article} />}
      {current?.error && <p role="alert" className="alert error">{current.error}</p>}
      {!current && <p role="status">Загружаем статью…</p>}
    </div>
  )
}
