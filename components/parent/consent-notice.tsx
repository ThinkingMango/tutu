import type { ConsentNotice } from '@/lib/cloud-consent/client'
import { parseNoticeSections } from '@/lib/cloud-consent/notice'

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

export function formatConsentDate(date: Date) {
  return DATE_FORMAT.format(date)
}

export function NoticeSections({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-6">
      {parseNoticeSections(body).map((section, index) => (
        <section key={section.heading ?? index} className="flex flex-col gap-2">
          {section.heading && <h3 className="text-base font-extrabold">{section.heading}</h3>}
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed text-pretty">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

export function ConsentNoticeArticle({ notice }: { notice: ConsentNotice }) {
  return (
    <article aria-labelledby="notice-title" className="flex flex-col gap-6 rounded-3xl border bg-card p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {`Notice for parents · Version ${notice.version} · ${formatConsentDate(notice.approvedAt)}`}
        </p>
        <h2 id="notice-title" className="text-2xl font-black text-balance">
          {notice.title}
        </h2>
      </header>
      <NoticeSections body={notice.body} />
    </article>
  )
}
