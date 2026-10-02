'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

const RECEIPT_URL = '/api/consent/receipt'
const FALLBACK_FILE_NAME = 'little-mandala-cloud-saving-permission.pdf'
const GENERIC_ERROR = 'We couldn’t create your permission record. Please try again.'

class ReceiptError extends Error {}

function fileNameFrom(disposition: string | null) {
  return /filename="([^"]+)"/.exec(disposition ?? '')?.[1] ?? FALLBACK_FILE_NAME
}

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function ConsentReceiptButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setError(null)
    setPending(true)
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await fetch(`${RECEIPT_URL}?tz=${encodeURIComponent(timeZone)}`, { cache: 'no-store' })
      if (response.status === 401) throw new ReceiptError('Please sign in again to download your permission record.')
      if (!response.ok) throw new ReceiptError(GENERIC_ERROR)
      saveFile(await response.blob(), fileNameFrom(response.headers.get('content-disposition')))
    } catch (err) {
      setError(err instanceof ReceiptError ? err.message : GENERIC_ERROR)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={() => void download()}
        disabled={pending}
        className="h-11 rounded-full px-5 font-bold"
      >
        <FileDown data-icon="inline-start" />
        {pending ? 'Preparing PDF…' : 'Download permission record (PDF)'}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
