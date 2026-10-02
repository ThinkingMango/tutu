'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parentGateStore } from '@/lib/device-stores'

export type Problem = Readonly<{ a: number; b: number }>

/**
 * A two-digit number times a small one: quick for a grown-up, out of reach for ages 3 to 7, and with
 * 22 possible answers between 36 and 95 a guess almost never works. No press-and-hold: a child
 * coached by a filling ring gets through that on their own.
 */
export function newProblem(random: () => number = Math.random): Problem {
  return { a: 12 + Math.floor(random() * 8), b: 3 + Math.floor(random() * 3) }
}

export function ParentGate({ next }: { next: string }) {
  const router = useRouter()
  // Made after the first render, so the server and browser draw the same page.
  const [problem, setProblem] = useState<Problem | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProblem(newProblem())
  }, [])

  const submitAnswer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!problem) return
    if (answer.trim() !== '' && Number(answer.trim()) === problem.a * problem.b) {
      parentGateStore.write(true)
      router.replace(next)
      return
    }
    setError('Not quite. Here is a new one.')
    setAnswer('')
    setProblem(newProblem())
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-black text-balance">Grown-ups only</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          Settings and picture packs live here. Answer the question to continue.
        </p>
      </div>

      <form onSubmit={submitAnswer} className="flex w-full flex-col gap-3 text-left" aria-busy={!problem}>
        <Label htmlFor="gate-answer" className="min-h-7 text-lg font-bold">
          {problem ? `What is ${problem.a} × ${problem.b}?` : ''}
        </Label>
        <div className="flex gap-3">
          <Input
            id="gate-answer"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'gate-error' : undefined}
            className="h-12 rounded-xl text-lg"
            disabled={!problem}
            autoFocus
          />
          <Button type="submit" disabled={!problem} className="h-12 rounded-xl px-6 text-base font-bold">
            Continue
          </Button>
        </div>
        {error && (
          <p id="gate-error" role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
