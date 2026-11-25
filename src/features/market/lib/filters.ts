import { CITY_INFO, REGIONS, type City, type Region } from '../../../core/constants/geo'
import { requiredSpecialties, sameIndustrySummary } from '../../../core/domain/matching'
import { vendorStats } from '../../../core/domain/vendorStats'
import type { Case, Company, Factory, Need, Review, ScaleTier, Specialty, Vendor } from '../../../core/types'

export function isFactory(c: Company | null | undefined): c is Factory {
  return !!c && c.role === 'factory'
}

export function isVendor(c: Company | null | undefined): c is Vendor {
  return !!c && c.role === 'vendor'
}

/** Open needs, newest first. */
export function openNeeds(needs: readonly Need[]): Need[] {
  return needs.filter((n) => n.status === 'open').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * The specialties a need asks for that this vendor offers (empty = no overlap).
 * If the need asks for core equipment besides EMS/carbon_consulting, require at least one core equipment match
 * so a compressed-air vendor with EMS isn't flagged as matching a 300kW solar+EMS project.
 */
export function matchedSpecialties(need: Need, vendor: Vendor): Specialty[] {
  const mine = new Set(vendor.vendor.specialties)
  const req = requiredSpecialties(need)
  const core = req.filter((s) => s !== 'ems')
  const matched = req.filter((s) => mine.has(s))
  if (core.length > 0 && !core.some((s) => mine.has(s))) return []
  return matched
}

export function matchesVendor(need: Need, vendor: Vendor | null | undefined): boolean {
  return !!vendor && matchedSpecialties(need, vendor).length > 0
}

export function needText(need: Need, factoryName: string | undefined): string {
  return [need.title, need.rawText, factoryName ?? '', need.form.mainProblems.join(' '), need.form.directions.join(' ')].join(' ').toLowerCase()
}

export interface NeedFilter {
  equips: readonly Specialty[]
  region: Region | ''
  scale: ScaleTier | ''
  q: string
}

export const EMPTY_NEED_FILTER: NeedFilter = { equips: [], region: '', scale: '', q: '' }

export function filterNeeds(needs: readonly Need[], factoryNames: ReadonlyMap<string, string>, f: NeedFilter): Need[] {
  const q = f.q.trim().toLowerCase()
  return needs.filter((n) => {
    if (f.equips.length && !n.form.items.some((i) => f.equips.includes(i.equip))) return false
    if (f.region && CITY_INFO[n.city]?.region !== f.region) return false
    if (f.scale && n.scale !== f.scale) return false
    if (q && !needText(n, factoryNames.get(n.factoryId)).includes(q)) return false
    return true
  })
}

/** Put needs that match the vendor's specialties first; keeps newest-first within each group. */
export function sortByFit(needs: readonly Need[], vendor: Vendor | null | undefined): Need[] {
  const fit = (n: Need) => (vendor ? matchedSpecialties(n, vendor).length : 0)
  return [...needs].sort((a, b) => fit(b) - fit(a) || b.createdAt.localeCompare(a.createdAt))
}

export type VendorSort = 'rating' | 'cases' | 'response'

export interface VendorFilter {
  specialty: Specialty | ''
  industry: string
  region: Region | ''
  city: string
  scale: ScaleTier | ''
  q: string
  sort: VendorSort
}

export const EMPTY_VENDOR_FILTER: VendorFilter = {
  specialty: '',
  industry: '',
  region: '',
  city: '',
  scale: '',
  q: '',
  sort: 'rating',
}

export function filterVendors(
  vendors: readonly Vendor[],
  reviews: readonly Review[],
  f: VendorFilter,
  opts?: { companies?: readonly Company[]; cases?: readonly Case[] },
): Vendor[] {
  const companies = opts?.companies ?? vendors
  const cases = opts?.cases ?? []
  const q = f.q.trim().toLowerCase()
  const out = vendors.filter((v) => {
    if (f.specialty && !v.vendor.specialties.includes(f.specialty)) return false
    if (f.industry && !sameIndustrySummary(v, f.industry, companies, cases).hasExperience) return false
    if (f.region && !v.vendor.serviceCities.some((c) => CITY_INFO[c].region === f.region)) return false
    if (f.city && !v.vendor.serviceCities.includes(f.city as City)) return false
    if (f.scale && !v.vendor.sizeFit.includes(f.scale)) return false
    if (q) {
      const hay = [
        v.name,
        v.city,
        v.vendor.tagline,
        v.intro,
        ...(v.vendor.servedIndustries ?? []),
        ...v.vendor.portfolio.flatMap((p) => [p.title, p.industry ?? '']),
        ...v.vendor.certifications,
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const stat = new Map(out.map((v) => [v.id, vendorStats(v.id, reviews)]))
  return out.sort((a, b) => {
    if (f.sort === 'cases') return b.vendor.completedCases - a.vendor.completedCases
    if (f.sort === 'response') return a.vendor.responseHours - b.vendor.responseHours
    return (stat.get(b.id)?.bayes ?? 0) - (stat.get(a.id)?.bayes ?? 0)
  })
}

/** Service cities grouped by region, in REGIONS order, skipping empty regions. */
export function groupByRegion(cities: readonly Vendor['city'][]): { region: Region; cities: Vendor['city'][] }[] {
  return REGIONS.map((region) => ({ region, cities: cities.filter((c) => CITY_INFO[c].region === region) })).filter((g) => g.cities.length)
}
