// src/data/resolve/buildTechCatalogView.ts

import type { CanonTechnology } from '../canon/canonTypes'
import { resolveTeamCombatMods } from './resolveCombatMods'

export type TechCatalogViewItem = {
  id: string
  baseId: string
  name: string

  civs: readonly string[]
  age?: 1 | 2 | 3 | 4

  producedBy: readonly string[]
  classes: readonly string[]

  isAvailable: boolean

  hasCombatEffects: boolean
  hasTargetConditional: boolean

  // UI grouping hint: baseId != id => likely a tiered line member (I/II/III)
  isTieredLineCandidate: boolean
}

export function buildTechCatalogView(args: {
  techs: readonly CanonTechnology[]
  civ: string
  age: 1 | 2 | 3 | 4
}): TechCatalogViewItem[] {
  const { techs, civ, age } = args
  const civNorm = norm(civ)

  const techById = new Map<string, CanonTechnology>()
  for (const t of techs) techById.set(norm(t.id), t)

  return techs.map((tech) => {
    const civsNorm = (tech.civs ?? []).map(norm)
    const civOk = civsNorm.length === 0 || civsNorm.includes(civNorm)
    const ageOk = tech.age == null || tech.age <= age
    const isAvailable = civOk && ageOk

    // compute combat effects via your existing resolver (real semantics)
    const mods = resolveTeamCombatMods({
      techById,
      selectedTechIds: [tech.id],
    })

    const hasCombatEffects = mods.effects.length > 0
    const hasTargetConditional = mods.effects.some((e) => e.target != null)

    return {
      id: tech.id,
      baseId: tech.baseId,
      name: tech.name,

      civs: tech.civs,
      age: tech.age as any,

      producedBy: (tech.producedBy ?? []).map(norm).filter(Boolean),
      classes: (tech.classes ?? []).map(norm).filter(Boolean),

      isAvailable,
      hasCombatEffects,
      hasTargetConditional,

      isTieredLineCandidate: norm(tech.baseId) !== norm(tech.id),
    }
  })
}

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}
