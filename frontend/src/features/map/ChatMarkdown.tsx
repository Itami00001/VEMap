import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ChatMarkdown({ content, pages, onPage }: {
  content: string
  pages?: number[]
  onPage: (page: number) => void
}) {
  return (
    <div className="chat-markdown" aria-label="ИИ">
      <Markdown skipHtml remarkPlugins={[remarkGfm]} disallowedElements={['img']}
        components={{
          a: ({ href, children }) => {
            const citation = href?.match(/^#page=([1-9]\d*)$/)
            if (citation) {
              const page = Number(citation[1])
              return pages?.includes(page)
                ? <button type="button" className="chat-citation" onClick={() => onPage(page)}>{children}</button>
                : <span>{children}</span>
            }
            return href && /^https?:\/\//i.test(href)
              ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>
          },
        }}>
        {content}
      </Markdown>
    </div>
  )
}
