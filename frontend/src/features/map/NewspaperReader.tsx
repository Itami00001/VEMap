import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export default function NewspaperReader({ url, initialPage }: { url: string; initialPage: number }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(initialPage)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)
  const [width, setWidth] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const viewer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const task = getDocument({ url, isEvalSupported: false })
    let disposed = false
    task.promise.then((pdf) => {
      if (disposed) return
      setDocument(pdf)
      setPage(Math.min(initialPage, pdf.numPages))
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
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const target = canvas.current
    if (!document || !target || !width) return
    let disposed = false
    let render: RenderTask | undefined
    setReady(false)
    document.getPage(page).then((sheet) => {
      if (disposed) return
      const viewport = sheet.getViewport({ scale: Math.min(width, 1000) / sheet.getViewport({ scale: 1 }).width })
      const density = Math.min(window.devicePixelRatio || 1, 2)
      target.width = Math.ceil(viewport.width * density)
      target.height = Math.ceil(viewport.height * density)
      target.style.width = `${viewport.width}px`
      render = sheet.render({ canvas: target, viewport, transform: [density, 0, 0, density, 0, 0] })
      return render.promise.then(() => { if (!disposed) setReady(true) })
    }).catch((failure: unknown) => {
      if (disposed) return
      console.warn('PDF page rendering failed', failure)
      setError(true)
    })
    return () => { disposed = true; render?.cancel() }
  }, [document, page, width])

  return (
    <div className="newspaper-reader">
      <div className="newspaper-toolbar">
        <button type="button" className="btn" onClick={() => setPage(page - 1)} disabled={!document || page <= 1}>Назад</button>
        <span aria-live="polite">Страница {page}{document ? ` из ${document.numPages}` : ''}</span>
        <button type="button" className="btn" onClick={() => setPage(page + 1)} disabled={!document || page >= document.numPages}>Далее</button>
        <a href={url} target="_blank" rel="noopener noreferrer">Открыть PDF отдельно</a>
      </div>
      <div className="newspaper-reader-page" ref={viewer}>
        {error && <p role="alert">Не удалось отобразить страницу. Откройте PDF отдельно.</p>}
        {!ready && !error && <p role="status">Загружаем страницу…</p>}
        <canvas ref={canvas} hidden={!ready || error} aria-label={`Газетная страница ${page}`} />
      </div>
    </div>
  )
}
