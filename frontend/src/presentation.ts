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

export function factKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
