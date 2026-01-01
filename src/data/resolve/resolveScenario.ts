// src/data/resolve/resolveScenario.ts

import type { UiScenarioState, TeamId, TierLabel } from '../../ui/uiStateTypes'
import { loadRawSnapshot } from '../raw/loadRawSnapshot'
import type { RawSnapshot } from '../raw/loadRawSnapshot'
import { buildCanonUnits } from '../canon/buildCanonUnits'
import { buildCanonTechnologies } from '../canon/buildCanonTechnologies'
import { buildCanonAbilities } from '../canon/buildCanonAbilities'
import { resolveTechLines } from './resolveTechLines'
import type { CanonUnit, CanonUnitVariation } from '../canon/canonTypes'
import { selectTierForLevel, getCompleteTierStats } from '../canon/tierLookup'
import type {
  ResolvedScenarioView,
  ResolvedTeamView,
  ResolvedUnitLine,
  ResolvedSimConfig,
  ResolvedSimTeam,
  ResolvedSimUnitGroup,
} from './resolvedViewTypes'
import { buildTechIndex, resolveTeamCombatMods, resolveUnitCombatMods } from './resolveCombatMods'

export function pickBaseVariation(
  vars: readonly CanonUnitVariation[],
  civ: string,
): CanonUnitVariation {
  if (!vars.length) throw new Error('pickBaseVariation: no variations')

  const pool = vars.filter((v) => v.civs?.includes(civ))
  const use = pool.length ? pool : vars

  return [...use].sort((a, b) => {
    const da = Number(a.age ?? 999)
    const db = Number(b.age ?? 999)
    if (da !== db) return da - db
    return String(a.id).localeCompare(String(b.id))
  })[0]
}

/**
 * Picks variation by requested tier using optimized data structure.
 * Falls back to base tier if requested tier is unavailable or age-gated.
 */
export function pickVariationByRequestedTier(args: {
  vars: readonly CanonUnitVariation[]
  civ: string
  teamAge: number
  tier: TierLabel
  unit?: CanonUnit // Optional: if provided, uses optimized lookup
}): CanonUnitVariation {
  const { vars, civ, teamAge, tier, unit } = args

  // Use optimized tier selection if unit object available
  if (unit) {
    const selected = selectTierForLevel(unit, tier, teamAge, civ)
    if (selected) {
      // Merge with shared tier stats for complete data
      return getCompleteTierStats(unit, selected)
    }
  }

  // Fallback to manual search (for non-optimized data or missing unit)
  const base = pickBaseVariation(vars, civ)
  if (tier === 'base') return base

  const wantAge = tier === 'veteran' ? 3 : 4

  const candidates = vars
    .filter((v) => v.civs?.includes(civ))
    .filter((v) => Number(v.age ?? 999) === wantAge)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const picked = candidates[0]
  if (!picked) return base
  if (Number(picked.age ?? 1) > teamAge) return base

  return picked
}

function unitById(units: CanonUnit[]): Map<string, CanonUnit> {
  const m = new Map<string, CanonUnit>()
  for (const u of units) m.set(u.id, u)
  return m
}

export type ResolveScenarioDebug = {
  droppedUnits: Array<{
    team: TeamId
    unitId: string
    reason: 'not_in_canon' | 'not_in_civ' | 'age_gated'
  }>
  droppedTechs: Array<{
    team: TeamId
    unitId?: string
    techId: string
    reason: 'unknown_tech_id' | 'age_gated' | 'civ_gated'
  }>
}

export type ResolveScenarioResult = {
  simConfig: ResolvedSimConfig
  view: ResolvedScenarioView
  debug?: ResolveScenarioDebug
}

export type ResolveScenarioOptions = {
  loadRawSnapshot?: (version?: string) => RawSnapshot
  includeDebug?: boolean
}

export function resolveScenario(
  ui: UiScenarioState,
  opts?: ResolveScenarioOptions,
): ResolveScenarioResult {
  const loadSnapshot = opts?.loadRawSnapshot ?? loadRawSnapshot
  const raw = loadSnapshot(ui.version)

  const canonUnits = buildCanonUnits(raw.units.data)
  const canonTechs = buildCanonTechnologies(raw.technologies.data)
  const canonAbilities = buildCanonAbilities(raw.abilities)
  // const canonUpgrades = buildCanonUpgrades(raw.upgrades.data) // not needed for tier stats currently

  const techById = buildTechIndex(canonTechs)
  const byId = unitById(canonUnits)

  const debug: ResolveScenarioDebug = {
    droppedUnits: [],
    droppedTechs: [],
  }

  /**
   * Build BOTH:
   * - UI-facing resolved unit lines (view)
   * - sim-facing unit groups (sim)
   *
   * in the SAME loop, so row filtering never breaks mapping.
   */
  function resolveTeamBoth(team: TeamId): { viewTeam: ResolvedTeamView; simTeam: ResolvedSimTeam } {
    const t = ui.teams[team]

    const rawTeamTechIds = t.selectedTechIds ?? []

    const {
      techIds: teamTechIds,
      unknownIds: unknownTeamTechs,
      gatedAgeIds: gatedAgeTeamTechs,
      gatedCivIds: gatedCivTeamTechs,
    } = resolveTechLines({
      techById: canonTechs, // Pass array instead of map for civ-aware filtering
      selectedTechIds: rawTeamTechIds,
      teamAge: t.age,
      teamCiv: t.civ,
    })

    // track unknown team techs if any
    if (unknownTeamTechs.length) {
      for (const id of unknownTeamTechs) {
        console.warn('[resolveScenario] unknown team tech', { team, techId: id })
        if (opts?.includeDebug) {
          debug.droppedTechs.push({ team, techId: id, reason: 'unknown_tech_id' })
        }
      }
    }

    // track age-gated team techs
    if (gatedAgeTeamTechs.length) {
      for (const id of gatedAgeTeamTechs) {
        console.warn('[resolveScenario] age-gated team tech', { team, techId: id })
        if (opts?.includeDebug) {
          debug.droppedTechs.push({ team, techId: id, reason: 'age_gated' })
        }
      }
    }
    // track civ-gated team techs
    if (gatedCivTeamTechs.length) {
      for (const id of gatedCivTeamTechs) {
        console.warn('[resolveScenario] civ-gated team tech', { team, techId: id })
        if (opts?.includeDebug) {
          debug.droppedTechs.push({ team, techId: id, reason: 'civ_gated' })
        }
      }
    }
    const teamCombatMods = resolveTeamCombatMods({
      techById,
      selectedTechIds: teamTechIds,
    })

    const viewLines: ResolvedUnitLine[] = []
    const simUnits: ResolvedSimUnitGroup[] = []

    for (const row of t.units) {
      const base = byId.get(row.unitId)
      if (!base) {
        if (opts?.includeDebug) {
          debug.droppedUnits.push({ team, unitId: row.unitId, reason: 'not_in_canon' })
        }
        continue
      }

      // UI already filters available units; keep resolver defensive.
      if (!base.civs.includes(t.civ)) {
        if (opts?.includeDebug) {
          debug.droppedUnits.push({ team, unitId: row.unitId, reason: 'not_in_civ' })
        }
        continue
      }

      const v = pickVariationByRequestedTier({
        vars: base.variations,
        civ: t.civ,
        teamAge: t.age,
        tier: row.tier,
        unit: base, // Pass unit for optimized tier lookup
      })

      // age gate (variation unlock)
      if (Number(v.age ?? 1) > t.age) {
        if (opts?.includeDebug) {
          debug.droppedUnits.push({ team, unitId: row.unitId, reason: 'age_gated' })
        }
        continue
      }

      // unit tech toggles (per-row)
      const rawUnitTechIds = row.unitTechs?.filter((x) => x.enabled).map((x) => String(x.id)) ?? []

      const {
        techIds: unitTechIds,
        unknownIds: unknownUnitTechs,
        gatedAgeIds: gatedAgeUnitTechs,
        gatedCivIds: gatedCivUnitTechs,
      } = resolveTechLines({
        techById: canonTechs, // Pass array instead of map for civ-aware filtering
        selectedTechIds: rawUnitTechIds,
        teamAge: t.age,
        teamCiv: t.civ,
      })

      // track unknown unit techs if any
      if (unknownUnitTechs.length) {
        for (const id of unknownUnitTechs) {
          console.warn('[resolveScenario] unknown unit tech', { team, unitId: base.id, techId: id })
          if (opts?.includeDebug) {
            debug.droppedTechs.push({
              team,
              unitId: base.id,
              techId: id,
              reason: 'unknown_tech_id',
            })
          }
        }
      }
      // track age-gated unit techs
      if (gatedAgeUnitTechs.length) {
        for (const id of gatedAgeUnitTechs) {
          console.warn('[resolveScenario] age-gated unit tech', {
            team,
            unitId: base.id,
            techId: id,
          })
          if (opts?.includeDebug) {
            debug.droppedTechs.push({ team, unitId: base.id, techId: id, reason: 'age_gated' })
          }
        }
      }
      // track civ-gated unit techs
      if (gatedCivUnitTechs.length) {
        for (const id of gatedCivUnitTechs) {
          console.warn('[resolveScenario] civ-gated unit tech', {
            team,
            unitId: base.id,
            techId: id,
          })
          if (opts?.includeDebug) {
            debug.droppedTechs.push({ team, unitId: base.id, techId: id, reason: 'civ_gated' })
          }
        }
      }
      const unitCombatMods = resolveUnitCombatMods({
        techById,
        unitTechIds,
      })

      // Link abilities to this unit (e.g., Camel Unease for desert raider)
      const unitAbilities = canonAbilities.byUnit.get(base.id) || []
      const abilityIds = unitAbilities
        .filter((ab) => ab.civs.includes(t.civ) && ab.minAge <= t.age)
        .map((ab) => ab.baseId)

      // UI-facing line
      viewLines.push({
        unitId: base.id,
        unitName: base.name,
        variationId: v.id,
        tier: row.tier,
        count: row.count,
        hitpoints: v.hitpoints,
        armor: v.armor,
        weapons: v.weapons,
        cost: v.cost,
        variationAge: v.age,
        unitCivs: base.civs,
        variationCivs: v.civs,
        abilityIds: abilityIds.length > 0 ? abilityIds : undefined,
      })

      // sim-facing group
      simUnits.push({
        unitId: base.id,
        variationId: v.id,
        count: row.count,
        unitTechIds,
        unitCombatMods,
        abilityIds: abilityIds.length > 0 ? abilityIds : undefined,
      })
    }

    const viewTeam: ResolvedTeamView = { team, civ: t.civ, age: t.age, units: viewLines }

    const simTeam: ResolvedSimTeam = {
      civ: t.civ,
      age: t.age,
      teamTechIds,
      teamCombatMods,
      units: simUnits,
    }

    return { viewTeam, simTeam }
  }

  const A = resolveTeamBoth('A')
  const B = resolveTeamBoth('B')

  const view: ResolvedScenarioView = {
    version: raw.version,
    teams: { A: A.viewTeam, B: B.viewTeam },
  }

  const simConfig: ResolvedSimConfig = {
    version: raw.version,
    teams: { A: A.simTeam, B: B.simTeam },
  }

  const result: ResolveScenarioResult = { simConfig, view }
  if (opts?.includeDebug) {
    result.debug = debug
  }
  return result
}
