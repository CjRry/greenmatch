import { SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { collectionStats, vendorInstalls, type CollectionStats, type VendorInstall } from '../../../core/domain/installs'
import { vendorStats } from '../../../core/domain/vendorStats'
import type { Company, Review, Specialty, Vendor } from '../../../core/types'
import { EXTRA_INSTALLS } from '../../../data/vendorInstalls'
import { isVendor } from './filters'

export interface VendorCollection {
  vendor: Vendor
  installs: VendorInstall[]
  stats: CollectionStats
  rating: { avg: number | null; count: number; bayes: number }
}

export function collectionFor(vendor: Vendor, reviews: readonly Review[]): VendorCollection {
  const installs = vendorInstalls(vendor, EXTRA_INSTALLS[vendor.id] ?? [])
  const r = vendorStats(vendor.id, reviews)
  return { vendor, installs, stats: collectionStats(installs), rating: { avg: r.avg, count: r.count, bayes: r.bayes } }
}

export type CollectionSort = 'installs' | 'saving' | 'rating'

/** Every vendor as a collection, ranked. Vendors without any install sort last. */
export function buildCollections(companies: readonly Company[], reviews: readonly Review[], sort: CollectionSort = 'installs'): VendorCollection[] {
  const list = companies.filter(isVendor).map((v) => collectionFor(v, reviews))
  const key = (c: VendorCollection) =>
    sort === 'saving' ? (c.stats.avgSavingPct ?? -1) : sort === 'rating' ? c.rating.bayes : c.stats.count
  return list.sort((a, b) => key(b) - key(a) || b.rating.bayes - a.rating.bayes || a.vendor.name.localeCompare(b.vendor.name, 'zh-Hant'))
}

/** Text a search box matches: name, tagline, city, service labels, and every install's title and industry. */
function haystack(c: VendorCollection): string {
  const v = c.vendor
  return [
    v.name,
    v.vendor.tagline,
    v.city,
    ...v.vendor.specialties.map((s) => SPECIALTY_LABEL[s]),
    ...c.installs.flatMap((i) => [i.title, i.industry]),
  ]
    .join(' ')
    .toLowerCase()
}

export function filterCollections(list: readonly VendorCollection[], specialty: Specialty | '', query = ''): VendorCollection[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter((c) => {
    if (specialty && !c.vendor.vendor.specialties.includes(specialty) && !c.installs.some((i) => i.equip === specialty)) return false
    if (!words.length) return true
    const text = haystack(c)
    return words.every((w) => text.includes(w))
  })
}
