import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export default function NewspaperThumbnail({ url, page = 1 }: { url: string; page?: number }) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState<string | null>(null)
  const key = url + ':' + page

  useEffect(() => {
    if (!container.current || visible) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { rootMargin: '120px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const task = getDocument({ url, isEvalSupported: false, disableAutoFetch: true, disableStream: true })
    let disposed = false
    let render: RenderTask | undefined
    async function draw() {
      const pdf = await task.promise
      if (disposed) return
      const sheet = await pdf.getPage(Math.min(page, pdf.numPages))
      const target = canvas.current
      if (!target || disposed) return
      const size = sheet.getViewport({ scale: 1 })
      const viewport = sheet.getViewport({ scale: 340 / Math.max(size.width, size.height) })
      target.width = Math.ceil(viewport.width)
      target.height = Math.ceil(viewport.height)
      render = sheet.render({ canvas: target, viewport })
      await render.promise
      if (!disposed) setRendered(key)
    }
    // PDF.js can report an uncaught worker error if destroyed while opening the document.
    void draw().catch(() => undefined).finally(() => task.destroy().catch(() => undefined))
    return () => {
      disposed = true
      render?.cancel()
    }
  }, [key, page, url, visible])

  return <div className="atlas-pdf-thumb" ref={container} aria-hidden="true">
    {rendered !== key && <span>PDF</span>}
    <canvas ref={canvas} hidden={rendered !== key} />
  </div>
}
