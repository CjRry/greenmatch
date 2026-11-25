import type { Review } from '../types'

export interface VendorStats {
  /** Plain average of ratings, or null with no reviews. */
  avg: number | null
  count: number
  /** Bayesian average (prior 4.0 with weight 5), stable for vendors with few reviews. */
  bayes: number
}

const PRIOR_MEAN = 4.0
const PRIOR_WEIGHT = 5

export function vendorStats(vendorId: string, reviews: readonly Review[]): VendorStats {
  const mine = reviews.filter((r) => r.vendorId === vendorId)
  const sum = mine.reduce((s, r) => s + r.rating, 0)
  return {
    avg: mine.length ? sum / mine.length : null,
    count: mine.length,
    bayes: (PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + mine.length),
  }
}
