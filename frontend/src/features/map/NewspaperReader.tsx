import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export default function NewspaperReader({ url, initialPage }: { url: string; initialPage: number }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(initialPage)
  const [error, setError] = useState(false)
  const [renderedPage, setRenderedPage] = useState<number | null>(null)
  const [width, setWidth] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const viewer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const task = getDocument({ url, isEvalSupported: false })
    let disposed = false
    setPdf(null)
    setRenderedPage(null)
    setError(false)
    task.promise.then((loaded) => {
      if (disposed) return
      setPdf(loaded)
      setPage(Math.max(1, Math.min(initialPage, loaded.numPages)))
    }).catch((failure: unknown) => {
      if (disposed) return
      console.warn('PDF loading failed', failure)
      setError(true)
    })
    return () => {
      disposed = true
      void task.destroy().catch(() => undefined)
    }
  }, [url, initialPage])

  useEffect(() => {
    const element = viewer.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.min(1000, Math.floor(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const target = canvas.current
    if (!pdf || !target || width < 1) return
    let disposed = false
    let render: RenderTask | undefined
    setError(false)
    pdf.getPage(page).then(async (sheet) => {
      if (disposed) return
      const viewport = sheet.getViewport({ scale: width / sheet.getViewport({ scale: 1 }).width })
      const density = Math.min(window.devicePixelRatio || 1, 2)
      // Keep the previous page visible until PDF.js finishes drawing the next frame.
      const frame = document.createElement('canvas')
      frame.width = Math.ceil(viewport.width * density)
      frame.height = Math.ceil(viewport.height * density)
      render = sheet.render({ canvas: frame, viewport, transform: [density, 0, 0, density, 0, 0] })
      await render.promise
      if (disposed) return
      target.width = frame.width
      target.height = frame.height
      target.style.width = `${viewport.width}px`
      target.getContext('2d')?.drawImage(frame, 0, 0)
      setRenderedPage(page)
    }).catch((failure: unknown) => {
      if (disposed) return
      console.warn('PDF page rendering failed', failure)
      setError(true)
    })
    return () => { disposed = true; render?.cancel() }
  }, [pdf, page, width])

  return (
    <div className="newspaper-reader">
      <div className="newspaper-toolbar">
        <button type="button" className="btn" onClick={() => setPage(page - 1)} disabled={!pdf || page <= 1}>Назад</button>
        <span aria-live="polite">Страница {page}{pdf ? ` из ${pdf.numPages}` : ''}</span>
        <button type="button" className="btn" onClick={() => setPage(page + 1)} disabled={!pdf || page >= pdf.numPages}>Далее</button>
        <a href={url} target="_blank" rel="noopener noreferrer">Открыть PDF отдельно</a>
      </div>
      <div className="newspaper-reader-page" ref={viewer} aria-busy={renderedPage !== page && !error}>
        {error && <p role="alert">Не удалось отобразить страницу. Откройте PDF отдельно.</p>}
        {renderedPage === null && !error && <p role="status">Загружаем страницу…</p>}
        <canvas ref={canvas} hidden={renderedPage === null} aria-label={`Газетная страница ${renderedPage ?? page}`} />
      </div>
    </div>
  )
}
