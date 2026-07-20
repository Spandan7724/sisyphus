const SECTION_LABELS: Record<string, string> = {
  identity: 'Personal details',
  contact: 'Contact details',
  eligibility: 'Work eligibility',
  employment: 'Work history',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  motivations: "What you're looking for",
  interests: 'Interests',
  logistics: 'Practical preferences',
  writing: 'Communication style',
  sensitive: 'Private context',
  other: 'Other details',
}

const FACT_LABELS: Record<string, string> = {
  portfolio_url: 'Portfolio',
  linkedin_url: 'LinkedIn',
  github_url: 'GitHub',
  preferred_name: 'Preferred name',
  work_authorization: 'Work authorization',
  voice_preferences: 'Writing preferences',
}

const SOURCE_LABELS: Record<string, string> = {
  resume: 'From resume',
  onboarding: 'From interview',
  manual: 'Added by you',
  application_learned: 'Learned while applying',
}

const SENSITIVITY_LABELS: Record<string, string> = {
  normal: 'Standard',
  personal: 'Personal',
  legal: 'Legal detail',
  sensitive: 'Private',
}

function titleCase(value: string): string {
  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const sectionLabel = (section: string) => SECTION_LABELS[section] ?? titleCase(section)
export const factLabel = (key: string) => FACT_LABELS[key] ?? titleCase(key)
export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? titleCase(source)
export const sensitivityLabel = (sensitivity: string) =>
  SENSITIVITY_LABELS[sensitivity] ?? titleCase(sensitivity)

const EVENT_VERBS: Record<string, string> = {
  'resume.ingested': 'read a resume',
  'resume.draft.extracted': 'extracted facts from the resume',
  'profile.fact.confirmed': 'confirmed a fact',
  'profile.fact.updated': 'updated a fact',
  'profile.fact.deleted': 'removed a fact',
  'profile.story.confirmed': 'confirmed a story',
  'onboarding.question.generated': 'prepared new questions',
  'onboarding.question.answered': 'recorded an answer',
}

// The ticker states what happened in the third person, without adjectives: reporting, not performing.
export function eventLine(event: {
  event_type: string
  actor: string
  reason: string | null
}): string {
  const who = event.actor === 'user' ? 'you' : 'agent'
  const verb = EVENT_VERBS[event.event_type] ?? titleCase(event.event_type.split('.').slice(1).join(' ')).toLowerCase()
  return event.reason ? `${who} ${verb} — ${event.reason}` : `${who} ${verb}`
}

export function factKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
