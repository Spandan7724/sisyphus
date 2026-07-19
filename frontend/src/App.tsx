// App shell: dossier-style sidebar navigation around the three phase-1 views.

import { useState } from 'react'
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

export default function App() {
  const [view, setView] = useState<View>('review')
  const live = useLiveEvents()

  const resumes = useResumes()
  const defaultResume = resumes.data?.find((r) => r.is_default) ?? resumes.data?.[0]
  const draft = useDraft(defaultResume?.id ?? null)
  const questions = useQuestions()
  const counts: Record<View, number | undefined> = {
    review: draft.data?.facts.filter((f) => !f.confirmed).length,
    interview: questions.data?.length,
    profile: undefined,
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 flex w-56 flex-col border-r border-line bg-paper px-4 py-6">
        <div className="px-2">
          <span className="font-display text-[19px] font-medium tracking-tight">
            Job<span className="text-moss italic"> Appli</span>
          </span>
          <p className="mt-0.5 text-[11px] text-ink-faint">your application dossier</p>
        </div>

        <nav className="mt-8 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors ${
                view === id
                  ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(35,32,25,0.06)] ring-1 ring-line'
                  : 'text-ink-soft hover:bg-line-soft hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
              {!!counts[id] && (
                <span className="ml-auto rounded-full bg-amber-soft px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-amber">
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-2 px-2.5 text-[11.5px] text-ink-faint">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-moss' : 'bg-ink-faint'}`}
          />
          {live ? 'agent stream live' : 'connecting…'}
        </div>
      </aside>

      <main className="ml-56 flex-1">
        <div className="mx-auto max-w-3xl px-8 py-10">
          {view === 'review' && <ReviewView />}
          {view === 'interview' && <OnboardingView />}
          {view === 'profile' && <ProfileView />}
        </div>
      </main>
    </div>
  )
}
