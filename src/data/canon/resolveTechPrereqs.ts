// src/data/canon/resolveTechPrereqs.ts
import type { CanonTechnology } from './canonTypes'

/**
 * Given a set of selected tech IDs and a tech being toggled, returns the new
 * set of selected techs with prerequisites automatically included or removed.
 *
 * When enabling a tech:
 * - Automatically enables all lower-tier techs in the same chain
 *
 * When disabling a tech:
 * - Automatically disables all higher-tier techs in the same chain
 *
 * Chains are identified by matching displayClass patterns like "Melee Damage Technology 1/3".
 * Tiers are extracted from the pattern (1/3, 2/3, 3/3).
 */
export function expandTechSelection(
  techId: string,
  enabled: boolean,
  currentSelection: readonly string[],
  allTechs: readonly CanonTechnology[],
): string[] {
  const toggledTech = allTechs.find((t) => t.id === techId)
  if (!toggledTech) {
    // Tech not found, just toggle it normally
    const prev = new Set(currentSelection)
    if (enabled) prev.add(techId)
    else prev.delete(techId)
    return Array.from(prev)
  }

  // Extract tier info from displayClasses (e.g., "Melee Damage Technology 2/3")
  const tierInfo = extractTierInfo(toggledTech)

  if (!tierInfo) {
    // Not a tiered tech, toggle normally
    const prev = new Set(currentSelection)
    if (enabled) prev.add(techId)
    else prev.delete(techId)
    return Array.from(prev)
  }

  // Find all techs in the same chain (same category, available to same civ)
  const { category, currentTier, maxTier: _maxTier } = tierInfo
  const chain = allTechs.filter((t) => {
    const info = extractTierInfo(t)
    if (!info) return false
    if (info.category !== category) return false
    // Check if this tech is available for at least one of the toggled tech's civs
    return t.civs.some((c) => toggledTech.civs.includes(c))
  })

  const next = new Set(currentSelection)

  if (enabled) {
    // Auto-enable all lower or equal tiers in this chain
    for (const t of chain) {
      const info = extractTierInfo(t)
      if (info && info.currentTier <= currentTier) {
        next.add(t.id)
      }
    }
  } else {
    // Auto-disable all higher or equal tiers in this chain
    for (const t of chain) {
      const info = extractTierInfo(t)
      if (info && info.currentTier >= currentTier) {
        next.delete(t.id)
      }
    }
  }

  return Array.from(next)
}

interface TierInfo {
  category: string // e.g., "Melee Damage Technology"
  currentTier: number // e.g., 2
  maxTier: number // e.g., 3
}

/**
 * Extract tier information from a tech's displayClasses.
 * Returns null if the tech doesn't have tier info.
 *
 * Examples:
 *   "Melee Damage Technology 1/3" → { category: "Melee Damage Technology", currentTier: 1, maxTier: 3 }
 *   "Ranged Armor Technology 2/3" → { category: "Ranged Armor Technology", currentTier: 2, maxTier: 3 }
 */
function extractTierInfo(tech: CanonTechnology): TierInfo | null {
  if (!tech.classes || !Array.isArray(tech.classes)) return null

  // Check if it has the tiered_upgrade marker
  const isTiered = tech.classes.some((c: string) => c.includes('tiered'))
  if (!isTiered) return null

  // Look for patterns like "Melee Damage Technology 2/3" in classes
  for (const cls of tech.classes) {
    const match = String(cls).match(/^(.+)\s+(\d+)\/(\d+)$/)
    if (match) {
      return {
        category: match[1].trim(),
        currentTier: Number(match[2]),
        maxTier: Number(match[3]),
      }
    }
  }

  return null
}
