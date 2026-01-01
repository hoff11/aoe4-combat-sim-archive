import type { CanonUnit, CanonUnitVariation } from './canonTypes'

/**
 * Helper utilities to leverage optimized data structure with shared tier stats.
 * Optimized files have a `shared` object with complete stats per tier (unit-2, unit-3, unit-4).
 */

export type TierLevel = 'base' | 'veteran' | 'elite'

/**
 * Maps tier level to target age.
 * - base: lowest available age (typically 2)
 * - veteran: age 3
 * - elite: age 4
 */
export function tierToAge(tier: TierLevel): number {
  switch (tier) {
    case 'base':
      return 2 // Will find lowest, but typically Age 2
    case 'veteran':
      return 3
    case 'elite':
      return 4
  }
}

/**
 * Gets all available tiers for a unit from the shared data structure.
 * Returns tier IDs like ['archer-2', 'archer-3', 'archer-4'].
 */
export function getAvailableTiers(unit: CanonUnit): string[] {
  const raw = unit as any
  if (!raw.shared || typeof raw.shared !== 'object') {
    // Fallback for non-optimized data: extract from variation IDs
    return unit.variations.map((v) => v.id)
  }
  return Object.keys(raw.shared).sort()
}

/**
 * Gets the tier ID for a specific age (e.g., age 3 → 'archer-3').
 * Returns undefined if no tier exists for that age.
 */
export function getTierIdForAge(unit: CanonUnit, age: number): string | undefined {
  const tiers = getAvailableTiers(unit)
  // Look for tier with format "unitId-{age}"
  const expected = `${unit.id}-${age}`
  if (tiers.includes(expected)) return expected

  // Fallback: find tier by age from variations
  const variation = unit.variations.find((v) => v.age === age)
  return variation?.id
}

/**
 * Gets stats for a specific tier directly from shared data.
 * This is more efficient than searching through variations.
 */
export function getSharedTierStats(unit: CanonUnit, tierId: string): any | undefined {
  const raw = unit as any
  return raw.shared?.[tierId]
}

/**
 * Gets the best available tier for the requested tier level and team age.
 * Respects age gating: if team is Age 2, cannot get Age 3+ tiers.
 */
export function selectTierForLevel(
  unit: CanonUnit,
  tierLevel: TierLevel,
  teamAge: number,
  civ: string,
): CanonUnitVariation | null {
  const targetAge = tierToAge(tierLevel)

  // Can't request a tier above team age
  const effectiveAge = Math.min(targetAge, teamAge)

  // Find variation matching civ and age
  const variation = unit.variations.find((v) => v.civs.includes(civ) && v.age === effectiveAge)

  if (variation) return variation

  // Fallback to lowest age if requested tier not available
  const lowestAge = Math.min(
    ...unit.variations.filter((v) => v.civs.includes(civ)).map((v) => v.age),
  )
  return unit.variations.find((v) => v.civs.includes(civ) && v.age === lowestAge) ?? null
}

/**
 * Gets complete stats for a tier, merging variation data with shared tier stats.
 * This is useful for display and combat calculations.
 */
export function getCompleteTierStats(
  unit: CanonUnit,
  variation: CanonUnitVariation,
): CanonUnitVariation {
  const sharedStats = getSharedTierStats(unit, variation.id)

  if (!sharedStats) {
    // No shared data, return variation as-is (non-optimized format)
    return variation
  }

  // Merge shared stats with variation (shared overrides variation for stats)
  return {
    ...variation,
    name: sharedStats.name ?? variation.name,
    weapons: sharedStats.weapons ?? variation.weapons,
    armor: sharedStats.armor ?? variation.armor,
    hitpoints: sharedStats.hitpoints ?? variation.hitpoints,
    classes: sharedStats.classes ?? variation.classes,
    movement: variation.movement, // Preserve movement from variation
    // Keep variation's civ, producedBy, costs, etc.
  }
}

/**
 * Quick check if unit has veteran/elite tiers available.
 */
export function hasVeteranTier(unit: CanonUnit): boolean {
  return getAvailableTiers(unit).some((t) => t.endsWith('-3'))
}

export function hasEliteTier(unit: CanonUnit): boolean {
  return getAvailableTiers(unit).some((t) => t.endsWith('-4'))
}
