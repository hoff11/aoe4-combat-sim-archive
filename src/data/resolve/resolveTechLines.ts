// src/data/resolve/resolveTechLines.ts

import type { CanonTechnology } from '../canon/canonTypes'

export function resolveTechLines(args: {
  techById: ReadonlyMap<string, CanonTechnology> | readonly CanonTechnology[]
  selectedTechIds: readonly string[]
  teamAge?: number
  teamCiv?: string
}): { techIds: string[]; unknownIds: string[]; gatedAgeIds: string[]; gatedCivIds: string[] } {
  const { selectedTechIds, teamAge, teamCiv } = args

  // Support both Map and Array for backward compatibility
  const techById: ReadonlyMap<string, CanonTechnology> =
    args.techById instanceof Map ? args.techById : buildTechMap(args.techById, teamCiv)

  // group selections by baseId (normalized)
  const byBase = new Map<string, string[]>()
  const unknownIds: string[] = []
  const gatedAgeIds: string[] = []
  const gatedCivIds: string[] = []

  for (const rawId of selectedTechIds) {
    const id = norm(rawId)
    if (!id) continue

    const tech = techById.get(id)
    if (!tech) {
      unknownIds.push(rawId)
      continue
    }

    // Enforce age/civ gating deterministically
    if (typeof teamAge === 'number' && typeof tech.age === 'number' && tech.age > teamAge) {
      gatedAgeIds.push(tech.id)
      continue
    }
    if (teamCiv && tech.civs && tech.civs.length) {
      const civNorm = norm(teamCiv)
      const techHasCiv = tech.civs.map(norm).includes(civNorm)
      if (!techHasCiv) {
        gatedCivIds.push(tech.id)
        continue
      }
    }

    const baseKey = norm(tech.baseId || tech.id) || id
    const arr = byBase.get(baseKey) ?? []
    arr.push(tech.id) // keep canonical id (original casing from canon)
    byBase.set(baseKey, arr)
  }

  // select "best" per line
  const out: string[] = []

  for (const [, ids] of byBase) {
    if (ids.length === 1) {
      out.push(ids[0]!)
      continue
    }

    let best = ids[0]!
    for (let i = 1; i < ids.length; i++) {
      const cand = ids[i]!
      if (isBetter({ techById, a: cand, b: best })) best = cand
    }
    out.push(best)
  }

  // stable-ish: deterministic ordering for snapshots / share links
  out.sort((a, b) => norm(a).localeCompare(norm(b)))
  return { techIds: out, unknownIds, gatedAgeIds, gatedCivIds }
}

function isBetter(args: {
  techById: ReadonlyMap<string, CanonTechnology>
  a: string
  b: string
}): boolean {
  const { techById, a, b } = args

  const ta = techById.get(norm(a))
  const tb = techById.get(norm(b))

  // If either missing, keep existing best (don’t churn unknowns)
  if (!ta || !tb) return false

  // 1) higher age wins (undefined treated as -1)
  const aa = ta.age ?? -1
  const ab = tb.age ?? -1
  if (aa !== ab) return aa > ab

  // 2) prefer a "tier member" over base tech when same age
  // (often baseId == id for the "line root")
  const aTier = norm(ta.baseId) !== norm(ta.id)
  const bTier = norm(tb.baseId) !== norm(tb.id)
  if (aTier !== bTier) return aTier

  // 3) deterministic tie-break
  return norm(ta.id) > norm(tb.id)
}

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Build a tech map that filters by civ.
 * In optimized format, we may have multiple techs with the same ID but different civs.
 * This function picks the tech that matches the team civ (or a generic one if no civ specified).
 */
function buildTechMap(
  techs: readonly CanonTechnology[],
  teamCiv?: string,
): Map<string, CanonTechnology> {
  const map = new Map<string, CanonTechnology>()
  const civNorm = teamCiv ? norm(teamCiv) : null

  for (const t of techs) {
    const key = norm(t.id)
    if (!key) continue

    // If we have a teamCiv preference, only keep techs that match
    if (civNorm && t.civs && t.civs.length > 0) {
      const techHasCiv = t.civs.map(norm).includes(civNorm)
      if (techHasCiv) {
        map.set(key, t) // Prefer civ-specific match
      } else if (!map.has(key)) {
        // Keep as fallback if we don't have a match yet
        map.set(key, t)
      }
    } else {
      // No civ constraint, or tech has no civ restriction
      if (!map.has(key)) {
        map.set(key, t)
      }
    }
  }

  return map
}
