/**
 * Demo seed for 綠媒 GreenMatch: fictional companies and cases, all marked isDemo.
 * Local mode loads it into the browser; for the shared claude.ai database the CEO writes the same
 * documents after publishing (npm run export-seed prints them).
 */
import type { Company } from '../../core/types'
import type { SeedData } from '../../core/store/local'
import { carbon } from './carbon'
import { buildCases } from './cases'
import { factories, vendors } from './companies'
import { reviews } from './reviews'

let cached: SeedData | null = null

export function seedData(): SeedData {
  if (!cached) {
    const companies: Company[] = [...factories, ...vendors]
    const bundle = buildCases(companies, reviews)
    cached = {
      companies,
      needs: bundle.needs,
      cases: bundle.cases,
      caseEvents: bundle.caseEvents,
      quotes: bundle.quotes,
      quoteComparisons: bundle.quoteComparisons,
      reviews,
      carbon,
    }
  }
  // Callers get their own copy so nothing can mutate the cached seed.
  return JSON.parse(JSON.stringify(cached)) as SeedData
}
