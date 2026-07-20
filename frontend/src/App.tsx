// App shell: dossier-style sidebar navigation around the three phase-1 views.

import { useEffect, useState } from 'react'
import { BookUser, ClipboardCheck, MessagesSquare } from 'lucide-react'
import { useDraft, useLiveEvents, useQuestions, useResumes } from './hooks'
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-ink px-3 py-2 text-[13px] text-surface transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 z-30 flex w-full flex-col border-b border-line bg-surface px-4 py-3 md:fixed md:inset-y-0 md:w-56 md:border-b-0 md:border-r md:py-6">
        <div className="flex items-center justify-between px-2 md:block md:border-b md:border-line md:pb-5">
          <div>
            <span className="font-display text-[19px] font-medium tracking-tight">
              Job<span className="text-moss italic"> Appli</span>
            </span>
            <p className="mt-0.5 hidden text-[11px] text-ink-soft sm:block">your application dossier</p>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-ink-soft md:hidden" role="status" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-moss' : 'bg-ink-faint'}`} aria-hidden="true" />
            {live ? 'Agent connected' : 'Connecting…'}
          </div>
        </div>

        <nav className="mt-3 flex gap-1 md:mt-8 md:block md:space-y-0.5" aria-label="Dossier sections">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              aria-current={view === id ? 'page' : undefined}
              className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper md:w-full md:justify-start md:gap-2.5 md:px-2.5 md:text-[13.5px] ${
                view === id
                  ? 'bg-moss font-medium text-white shadow-[0_1px_2px_rgba(35,32,25,0.08)]'
                  : 'text-ink-soft hover:bg-line-soft hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{label}</span>
              {!!counts[id] && (
                <span
                  className={`hidden rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums sm:inline-flex md:ml-auto ${view === id ? 'bg-surface text-amber' : 'bg-amber-soft text-amber'}`}
                  aria-label={`${counts[id]} ${countLabels[id]}`}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto hidden items-center gap-2 px-2.5 text-[11.5px] text-ink-soft md:flex" role="status" aria-live="polite">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-moss' : 'bg-ink-faint'}`}
            aria-hidden="true"
          />
          {live ? 'Agent connected' : 'Connecting…'}
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="w-full flex-1 md:ml-56">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
          {view === 'review' && <ReviewView />}
          {view === 'interview' && <OnboardingView />}
          {view === 'profile' && <ProfileView />}
        </div>
      </main>
    </div>
  )
}
