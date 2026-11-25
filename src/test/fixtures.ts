import { seedData } from '../data/seed'
import type { SeedData } from '../core/store/local'

/**
 * Test data: the full demo seed (frozen with the foundation). Known ids:
 * - factories f01–f12, vendors v01–v11 (f01 永豐金屬 is the deck's air-compressor example)
 * - cases: c01 at 'quote' with 2 quotes and no saved comparison; c02/c13 'survey'; c04 'contract';
 *   c03 'construction'; c05 'acceptance'; c06 'compare' completed; c07 'compare' active;
 *   c08–c12 'assess' with open needs n08–n12
 * - carbon: f01 2025 + 2026, f02, f03, f04, f06 2026
 */
export function fixtureData(): SeedData {
  return seedData()
}

/** An empty store: every collection exists with no documents. */
export function emptyData(): SeedData {
  return {}
}
