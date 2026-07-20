// App shell: a chrome bar carrying the live activity ticker above a stone sidebar and the work surface.

import { useEffect, useState } from 'react'
import { BookUser, ClipboardCheck, MessagesSquare } from 'lucide-react'
import { LiveContext, useDraft, useLiveEvents, useQuestions, useResumes } from './hooks'
import { eventLine } from './presentation'
import { ReviewView } from './views/Review'
import { OnboardingView } from './views/Onboarding'
import { ProfileView } from './views/Profile'

type View = 'review' | 'interview' | 'profile'

const NAV: { id: View; label: string; icon: typeof BookUser }[] = [
  { id: 'review', label: 'Review', icon: ClipboardCheck },
  { id: 'interview', label: 'Interview', icon: MessagesSquare },
  { id: 'profile', label: 'Profile', icon: BookUser },
]

function viewFromLocation(): View {
  const candidate = window.location.hash.slice(1)
  return NAV.some(({ id }) => id === candidate) ? (candidate as View) : 'review'
}

export default function App() {
  const [view, setView] = useState<View>(viewFromLocation)
  const live = useLiveEvents()
  const { connected, latest } = live

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#review')
    const onPopState = () => setView(viewFromLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const resumes = useResumes()
  const defaultResume = resumes.data?.find((r) => r.is_default) ?? resumes.data?.[0]
  const draft = useDraft(defaultResume?.id ?? null)
  const questions = useQuestions()
  const counts: Record<View, number | undefined> = {
    review: draft.data?.facts.filter((f) => !f.confirmed).length,
    interview: questions.data?.filter((question) => !question.optional).length,
    profile: undefined,
  }
  const countTone: Record<View, string> = {
    review: 'bg-draft-soft text-draft ring-draft-mark/30',
    interview: 'bg-held-soft text-held ring-held-mark/30',
    profile: 'bg-panel text-ink-3 ring-line',
  }
  const countLabels: Record<View, string> = {
    review: 'facts to review',
    interview: 'required questions',
    profile: '',
  }

  const navigate = (nextView: View) => {
    if (nextView === view) return
    window.history.pushState(null, '', `#${nextView}`)
    setView(nextView)
  }

  return (
    <LiveContext.Provider value={live}>
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded bg-ink px-3 py-2 text-[13px] text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-ground px-5">
        <span className="shrink-0 text-[17.5px] font-semibold tracking-tight">Appli</span>
        <div
          className="flex min-w-0 items-center gap-2.5 font-mono text-[13.5px] text-ink-2"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-work-mark' : 'bg-idle'}`}
            aria-hidden="true"
          />
          <span className="truncate">
            {!connected ? 'connecting…' : latest ? eventLine(latest) : 'idle — no activity yet'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-line bg-panel p-3 md:w-60 md:border-b-0 md:border-r">
          <nav className="flex gap-1 md:flex-col md:gap-0.5" aria-label="Sections">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                aria-current={view === id ? 'page' : undefined}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded px-3 py-2.5 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-work-mark/30 md:w-full ${
                  view === id
                    ? 'bg-ground font-semibold text-ink ring-1 ring-inset ring-line-firm'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{label}</span>
                {!!counts[id] && (
                  <span
                    className={`ml-auto hidden items-center rounded-sm px-1.5 py-0.5 font-mono text-[12px] tabular-nums ring-1 ring-inset sm:inline-flex ${countTone[id]}`}
                    aria-label={`${counts[id]} ${countLabels[id]}`}
                  >
                    {counts[id]}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
            {view === 'review' && <ReviewView />}
            {view === 'interview' && <OnboardingView />}
            {view === 'profile' && <ProfileView />}
          </div>
        </main>
      </div>
    </div>
    </LiveContext.Provider>
  )
}
