import { useEffect, useRef } from 'react'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { WORLD_GEOJSON_URL } from '../../services/api'
import { wiki } from '../../services/wiki'
import type { WikiPoint } from '../../services/wiki'
import { sentimentColor } from './color'

type Basemap = FeatureCollection<Polygon | MultiPolygon>
let basemap: Promise<Basemap> | undefined

function getBasemap() {
  basemap ??= fetch(WORLD_GEOJSON_URL).then((response) => {
    if (!response.ok) throw new Error('Map preview unavailable')
    return response.json() as Promise<Basemap>
  }).catch((error: unknown) => {
    basemap = undefined
    throw error
  })
  return basemap
}

function drawMap(canvas: HTMLCanvasElement, geometry: Basemap, points: WikiPoint[]) {
  const context = canvas.getContext('2d')
  if (!context || !points.length) return
  const { width, height } = canvas
  const lon = points.map((point) => point.lon)
  const lat = points.map((point) => point.lat)
  const xMin = Math.min(...lon), xMax = Math.max(...lon)
  const yMin = Math.min(...lat), yMax = Math.max(...lat)
  const centerX = (xMin + xMax) / 2, centerY = (yMin + yMax) / 2
  const stretch = Math.max(0.25, Math.cos(centerY * Math.PI / 180))
  const scale = Math.min((width - 34) / Math.max(4, (xMax - xMin) * stretch),
    (height - 34) / Math.max(3, yMax - yMin))
  const project = (x: number, y: number): [number, number] =>
    [width / 2 + (x - centerX) * stretch * scale, height / 2 - (y - centerY) * scale]

  context.fillStyle = '#273857'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#424953'
  context.strokeStyle = '#62717f'
  context.lineWidth = 0.65
  for (const { geometry: shape } of geometry.features) {
    const polygons = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates
    for (const polygon of polygons) {
      context.beginPath()
      for (const ring of polygon) {
        ring.forEach(([x, y], index) => {
          const [px, py] = project(x, y)
          if (index === 0) context.moveTo(px, py)
          else context.lineTo(px, py)
        })
        context.closePath()
      }
      context.fill('evenodd')
      context.stroke()
    }
  }
  context.lineWidth = 1.6
  context.strokeStyle = '#f9f5eb'
  for (const point of points) {
    const [x, y] = project(point.lon, point.lat)
    context.fillStyle = point.mood_index === null ? '#778798' : sentimentColor(point.mood_index / 100)
    context.beginPath()
    context.arc(x, y, 4, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
}

export default function WikiMapPreview({ id }: { id: string }) {
  const preview = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = preview.current
    if (!canvas) return
    const controller = new AbortController()
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      Promise.all([wiki.get(id, controller.signal), getBasemap()]).then(([article, geometry]) => {
        if (!controller.signal.aborted) drawMap(canvas, geometry, article.points)
      }).catch(() => undefined)
    }, { rootMargin: '100px' })
    observer.observe(canvas)
    return () => { observer.disconnect(); controller.abort() }
  }, [id])
  return <canvas className="atlas-wiki-minimap" ref={preview} width={220} height={160} aria-hidden="true" />
}
