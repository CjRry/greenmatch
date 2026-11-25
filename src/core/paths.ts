import type { Role, Specialty } from './types'

/** Every in-app link goes through these builders so routes stay in one place (src/app/routes.tsx). */
export type HubTab = string

export const paths = {
  home: () => '/',
  register: (role?: Role) => (role ? `/register?role=${role}` : '/register'),
  needs: () => '/needs',
  need: (id: string) => `/needs/${encodeURIComponent(id)}`,
  /** Optional initial filter, read by VendorDirectory from ?specialty= */
  vendors: (filter?: { specialty?: Specialty }) => (filter?.specialty ? `/vendors?specialty=${filter.specialty}` : '/vendors'),
  vendor: (id: string) => `/vendors/${encodeURIComponent(id)}`,
  factory: (id: string) => `/factories/${encodeURIComponent(id)}`,
  me: (tab?: HubTab) => (tab ? `/me?tab=${encodeURIComponent(tab)}` : '/me'),
  profile: () => '/me/profile',
  newNeed: () => '/new-need',
  case: (id: string) => `/cases/${encodeURIComponent(id)}`,
  caseMatch: (id: string) => `/cases/${encodeURIComponent(id)}/match`,
  caseQuotes: (id: string) => `/cases/${encodeURIComponent(id)}/quotes`,
  caseQuoteNew: (id: string) => `/cases/${encodeURIComponent(id)}/quote/new`,
  carbon: () => '/carbon',
  carbonEntry: () => '/carbon/entry',
  billCheckup: () => '/bill-checkup',
  feedback: () => '/feedback',
  /** 公開案例與回本回測（PROP-0006）. */
  publicCases: () => '/public-cases',
  /** 關於我們・平台原則・資料與隱私（PROP-0007 4d）. */
  about: () => '/about',
  /** 方法與公式出處總覽（PROP-0007 4d）. */
  methodology: () => '/methodology',
} as const
