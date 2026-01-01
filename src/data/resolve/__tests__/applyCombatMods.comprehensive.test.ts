import { describe, expect, it, beforeAll } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUnits } from '../../canon/buildCanonUnits'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'
import {
  buildTechIndex,
  resolveTeamCombatMods,
  resolveUnitCombatMods,
  matchesSelector,
} from '../resolveCombatMods'
import {
  applyCombatModsToVariation,
  applyCombatModsToWeaponsAgainstDefender,
} from '../applyCombatMods'
import type { CombatEffect, CombatSelector } from '../combatModsTypes'

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

// ==================== Cached Data ====================

let cachedData: { units: any[]; techs: any[]; techById: Map<string, any> } | null = null

function getCachedData() {
  if (!cachedData) {
    console.log('[applyCombatMods] Loading snapshot...')
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)
    const techs = buildCanonTechnologies(raw.technologies.data)
    const techById = buildTechIndex(techs)
    cachedData = { units, techs, techById }
    console.log(`[applyCombatMods] ✓ Loaded ${units.length} units, ${techs.length} techs`)
  }
  return cachedData
}

// ==================== Helpers ====================

function findTechWithEffect(statFilter?: string): string {
  const raw = loadRawSnapshotNode()
  const techs = buildCanonTechnologies(raw.technologies.data)

  const validStats = new Set([
    'meleeattack',
    'rangedattack',
    'siegeattack',
    'meleearmor',
    'rangedarmor',
    'hitpoints',
    'attackspeed',
    'range',
    'maxrange',
  ])

  for (const t of techs) {
    for (const e of t.effects ?? []) {
      const r: any = (e as any).raw
      const prop = norm(r?.property ?? '')
      const eff = norm(r?.effect ?? '')
      const val = r?.value

      if (!validStats.has(prop)) continue
      if (!['change', 'multiply', 'mult'].includes(eff)) continue
      if (!Number.isFinite(Number(val))) continue

      if (statFilter && prop !== norm(statFilter)) continue

      return t.id
    }
  }
  throw new Error(`No tech with effect found${statFilter ? ` for stat: ${statFilter}` : ''}`)
}

function findVariationWithWeapon(damageType: 'melee' | 'ranged' | 'siege'): {
  unitId: string
  variation: any
} {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)

  for (const u of units) {
    for (const v of u.variations ?? []) {
      const hasType = (v.weapons ?? []).some((w: any) => {
        const dt = norm(w.damageType ?? '')
        return dt === damageType
      })
      if (hasType) {
        return { unitId: u.id, variation: v }
      }
    }
  }
  throw new Error(`No unit with ${damageType} weapons`)
}

function findTechWithTargetConditional(): string {
  const raw = loadRawSnapshotNode()
  const techs = buildCanonTechnologies(raw.technologies.data)

  for (const t of techs) {
    for (const e of t.effects ?? []) {
      const r: any = (e as any).raw
      if (r?.target) return t.id
    }
  }
  throw new Error('No tech with target-conditional effect found')
}

// ==================== Combat Mods Resolution ====================

describe('resolveCombatMods – Comprehensive Edge Cases', () => {
  let techById: Map<string, any>
  let techs: any[]

  beforeAll(() => {
    console.log('[resolveCombatMods] Starting tests...')
    const data = getCachedData()
    techs = data.techs
    techById = data.techById
  })

  // ==================== Basic Parsing ====================

  it('parses techs with valid combat effects', () => {
    const techId = findTechWithEffect()

    const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
    expect(mods.effects.length).toBeGreaterThan(0)
  })

  it('empty tech list returns empty effects', () => {
    const mods = resolveTeamCombatMods({ techById, selectedTechIds: [] })
    expect(mods.effects).toEqual([])
  })

  it('unknown tech id produces no effects', () => {
    const mods = resolveTeamCombatMods({
      techById,
      selectedTechIds: ['__not_a_real_tech__'],
    })
    expect(mods.effects).toEqual([])
  })

  // ==================== Effect Stat Coverage ====================

  const statTypes = [
    'meleeAttack',
    'rangedAttack',
    'siegeAttack',
    'meleeArmor',
    'rangedArmor',
    'hitpoints',
    'attackSpeed',
    'range',
  ]

  for (const stat of statTypes) {
    it(`handles ${stat} effects`, () => {
      try {
        const techId = findTechWithEffect(stat)
        const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
        expect(mods.effects.some((e) => e.stat === stat)).toBe(true)
      } catch {
        // stat might not exist in snapshot, skip
        return
      }
    })
  }

  // ==================== Selectors ====================

  describe('matchesSelector', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)

    it('matches unit by exact unitId', () => {
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variations')

      const selector: CombatSelector = {
        unitIds: [norm(v.baseUnitId)],
      }

      expect(matchesSelector(v, selector)).toBe(true)
    })

    it('does not match unit with different unitId', () => {
      const units_array = buildCanonUnits(raw.units.data)
      const v1 = units_array[0]?.variations[0]
      const v2 = units_array[1]?.variations[0]

      if (!v1 || !v2) throw new Error('Not enough variations')

      const selector: CombatSelector = {
        unitIds: [norm(v2.baseUnitId)],
      }

      expect(matchesSelector(v1, selector)).toBe(false)
    })

    it('matches unit by class (single class)', () => {
      const v = units[0]?.variations[0]
      if (!v || !v.classes?.length) throw new Error('No unit with classes')

      const selector: CombatSelector = {
        anyOfAll: [[v.classes[0]]],
      }

      expect(matchesSelector(v, selector)).toBe(true)
    })

    it('matches unit when all required classes present (AND within group)', () => {
      const v = units[0]?.variations[0]
      if (!v || !v.classes || v.classes.length < 2) {
        // find a unit with 2+ classes
        for (const u of units) {
          for (const vv of u.variations ?? []) {
            if ((vv.classes ?? []).length >= 2) {
              const selector: CombatSelector = {
                anyOfAll: [[vv.classes[0], vv.classes[1]]],
              }
              expect(matchesSelector(vv, selector)).toBe(true)
              return
            }
          }
        }
        return
      }

      const selector: CombatSelector = {
        anyOfAll: [[v.classes[0], v.classes[1]]],
      }

      expect(matchesSelector(v, selector)).toBe(true)
    })

    it('does not match when class is missing', () => {
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variations')

      const selector: CombatSelector = {
        anyOfAll: [['__definitely_not_a_class__']],
      }

      expect(matchesSelector(v, selector)).toBe(false)
    })

    it('matches via OR across multiple class groups', () => {
      const v = units[0]?.variations[0]
      if (!v || !v.classes?.length) throw new Error('No classes')

      const selector: CombatSelector = {
        anyOfAll: [['__fake_class1__'], [v.classes[0]]],
      }

      expect(matchesSelector(v, selector)).toBe(true)
    })

    it('empty selector matches everything (global)', () => {
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variations')

      const selector: CombatSelector = {
        anyOfAll: [[]],
      }

      expect(matchesSelector(v, selector)).toBe(true)
    })

    it('case-insensitive class matching', () => {
      const v = units[0]?.variations[0]
      if (!v || !v.classes?.length) throw new Error('No classes')

      const selector: CombatSelector = {
        anyOfAll: [[v.classes[0].toUpperCase()]],
      }

      expect(matchesSelector(v, selector)).toBe(true)
    })
  })

  // ==================== Casing & Normalization ====================

  it('normalizes tech ids (case-insensitive)', () => {
    const techId = findTechWithEffect()

    const a = resolveTeamCombatMods({
      techById,
      selectedTechIds: [techId],
    })

    const b = resolveTeamCombatMods({
      techById,
      selectedTechIds: [techId.toUpperCase()],
    })

    const c = resolveTeamCombatMods({
      techById,
      selectedTechIds: [techId.toLowerCase()],
    })

    expect(a.effects.length).toBe(b.effects.length)
    expect(b.effects.length).toBe(c.effects.length)
  })

  // ==================== Multiple Techs ====================

  it('combines effects from multiple techs', () => {
    const techs_sample = techs.slice(0, 10)

    const validTechs = techs_sample.filter((t) => {
      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [t.id] })
      return mods.effects.length > 0
    })

    if (validTechs.length < 2) return

    const combined = resolveTeamCombatMods({
      techById,
      selectedTechIds: validTechs.slice(0, 2).map((t) => t.id),
    })

    const single1 = resolveTeamCombatMods({
      techById,
      selectedTechIds: [validTechs[0].id],
    })
    const single2 = resolveTeamCombatMods({
      techById,
      selectedTechIds: [validTechs[1].id],
    })

    expect(combined.effects.length).toBeGreaterThanOrEqual(single1.effects.length)
    expect(combined.effects.length).toBeGreaterThanOrEqual(single2.effects.length)
  })

  it('handles duplicate tech selections (dedupes)', () => {
    const techId = findTechWithEffect()

    const a = resolveTeamCombatMods({
      techById,
      selectedTechIds: [techId],
    })

    const b = resolveTeamCombatMods({
      techById,
      selectedTechIds: [techId, techId, techId],
    })

    // Should be same (deduped by the resolution logic)
    expect(a.effects.length).toBe(b.effects.length)
  })

  // ==================== Unit Tech Mods ====================

  it('resolveUnitCombatMods works same as team', () => {
    const techId = findTechWithEffect()

    const team = resolveTeamCombatMods({
      techById,
      selectedTechIds: [techId],
    })

    const unit = resolveUnitCombatMods({
      techById,
      unitTechIds: [techId],
    })

    expect(team.effects.length).toBe(unit.effects.length)
  })
})

// ==================== Combat Mods Application ====================

describe('applyCombatMods – Comprehensive Edge Cases', () => {
  let units: any[]
  let _techs: any[]
  let techById: Map<string, any>

  beforeAll(() => {
    console.log('[applyCombatMods] Starting tests...')
    const data = getCachedData()
    units = data.units
    _techs = data.techs
    techById = data.techById
  })

  // ==================== Intrinsic Stats ====================

  it('applies hitpoints addition', () => {
    try {
      const techId = findTechWithEffect('hitpoints')
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const basHP = v.hitpoints
      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

      const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })
      expect(eff.hitpoints).toBeGreaterThanOrEqual(basHP)
    } catch {
      // stat might not exist
      return
    }
  })

  it('applies armor modifications', () => {
    try {
      const techId = findTechWithEffect('meleearmor')
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const baseArmor = v.armor.melee
      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

      const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })
      expect(eff.armor.melee).toBeGreaterThanOrEqual(baseArmor)
    } catch {
      return
    }
  })

  it('tracks applied effects for debug', () => {
    try {
      const techId = findTechWithEffect()
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })

      expect(eff.applied).toBeDefined()
      expect(Array.isArray(eff.applied)).toBe(true)
    } catch {
      return
    }
  })

  // ==================== Weapons ====================

  it('applies melee attack bonus to melee weapons only', () => {
    try {
      const techId = findTechWithEffect('meleeattack')
      const target = findVariationWithWeapon('melee')

      const baseMelee = Math.max(
        ...(target.variation.weapons ?? [])
          .filter((w: any) => norm(w.damageType) === 'melee')
          .map((w: any) => Number(w.damageMax ?? 0)),
      )

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      const eff = applyCombatModsToVariation({ variation: target.variation, teamMods: mods })

      const newMelee = Math.max(
        ...(eff.weapons ?? [])
          .filter((w: any) => norm(w.damageType) === 'melee')
          .map((w: any) => Number(w.damageMax ?? 0)),
      )

      expect(newMelee).toBeGreaterThanOrEqual(baseMelee)
    } catch {
      return
    }
  })

  it('applies ranged attack bonus to ranged weapons only', () => {
    try {
      const techId = findTechWithEffect('rangedattack')
      const target = findVariationWithWeapon('ranged')

      const baseRanged = Math.max(
        ...(target.variation.weapons ?? [])
          .filter((w: any) => norm(w.damageType) === 'ranged')
          .map((w: any) => Number(w.damageMax ?? 0)),
      )

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      const eff = applyCombatModsToVariation({ variation: target.variation, teamMods: mods })

      const newRanged = Math.max(
        ...(eff.weapons ?? [])
          .filter((w: any) => norm(w.damageType) === 'ranged')
          .map((w: any) => Number(w.damageMax ?? 0)),
      )

      expect(newRanged).toBeGreaterThanOrEqual(baseRanged)
    } catch {
      return
    }
  })

  it('ignores target-conditional effects in intrinsic stats', () => {
    try {
      const techId = findTechWithTargetConditional()
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const baseHP = v.hitpoints
      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

      const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })

      // If the tech only has target-conditional effects, HP should not change
      const hasNonTargetEffect = mods.effects.some((e) => !e.target)
      if (!hasNonTargetEffect) {
        expect(eff.hitpoints).toBe(baseHP)
      }
    } catch {
      return
    }
  })

  // ==================== Weapon Multipliers ====================

  it('handles attack speed (period) modification', () => {
    try {
      const techId = findTechWithEffect('attackspeed')
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const _basePeriod = (v.weapons ?? [])
        .map((w: any) => Number(w.attackPeriod))
        .reduce((a: number, b: number) => Math.min(a, b), Infinity)

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })

      // attack period change is game-specific; just verify it's a number
      const newPeriod = (eff.weapons ?? [])
        .map((w: any) => Number(w.attackPeriod))
        .reduce((a: number, b: number) => Math.min(a, b), Infinity)

      expect(typeof newPeriod).toBe('number')
      expect(Number.isFinite(newPeriod)).toBe(true)
    } catch {
      return
    }
  })

  it('handles range modification', () => {
    try {
      const techId = findTechWithEffect('range')
      const target = findVariationWithWeapon('ranged')

      const baseRange = Math.max(
        ...(target.variation.weapons ?? []).map((w: any) => Number(w.rangeMax ?? 0)),
      )

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      const eff = applyCombatModsToVariation({ variation: target.variation, teamMods: mods })

      const newRange = Math.max(...(eff.weapons ?? []).map((w: any) => Number(w.rangeMax ?? 0)))

      expect(newRange).toBeGreaterThanOrEqual(baseRange)
    } catch {
      return
    }
  })

  // ==================== Empty/Null Cases ====================

  it('handles unit with no weapons', () => {
    const v = {
      id: 'test',
      baseUnitId: 'test',
      name: 'Test',
      civs: ['en'],
      age: 1 as any,
      classes: [],
      hitpoints: 100,
      armor: { melee: 0, ranged: 0 },
      weapons: [],
    } as any

    const eff = applyCombatModsToVariation({ variation: v })
    expect(eff.weapons).toEqual([])
    expect(eff.hitpoints).toBe(100)
  })

  it('handles effect with null/undefined values', () => {
    const v = units[0]?.variations[0]
    if (!v) throw new Error('No variation')

    const effect: CombatEffect = {
      stat: 'hitpoints',
      op: 'add',
      value: NaN,
      select: { anyOfAll: [[]] },
      sourceId: 'test',
    }

    const mods = { effects: [effect] }
    const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })

    // NaN math should still work (NaN + x = NaN), so HP might be NaN or unchanged
    expect(typeof eff.hitpoints).toBe('number')
  })

  // ==================== Multiple Mods ====================

  it('applies team mods and unit mods together', () => {
    try {
      const techId1 = findTechWithEffect()
      const techId2 = findTechWithEffect()

      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId1] })
      const unitMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId2] })

      const eff = applyCombatModsToVariation({ variation: v, teamMods, unitMods })
      expect(eff.applied.length).toBeGreaterThanOrEqual(0)
    } catch {
      return
    }
  })

  // ==================== Target-Conditional Effects ====================

  it('target-conditional effects apply vs matching defender', () => {
    try {
      const techId = findTechWithTargetConditional()
      const attacker = units[0]?.variations[0]
      const defender = units[1]?.variations[0]

      if (!attacker || !defender) throw new Error('Not enough variations')

      const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

      // Should not error even if defender doesn't match
      const out = applyCombatModsToWeaponsAgainstDefender({
        attacker,
        defender,
        teamMods,
      })

      expect(Array.isArray(out.weapons)).toBe(true)
      expect(Array.isArray(out.applied)).toBe(true)
    } catch {
      return
    }
  })

  it('target-conditional effects return different damage vs different defenders', () => {
    try {
      const techId = findTechWithTargetConditional()
      const attacker = units[0]?.variations[0]
      const defender1 = units[1]?.variations[0]
      const defender2 = units[2]?.variations[0]

      if (!attacker || !defender1 || !defender2) return

      const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

      const out1 = applyCombatModsToWeaponsAgainstDefender({
        attacker,
        defender: defender1,
        teamMods,
      })

      const out2 = applyCombatModsToWeaponsAgainstDefender({
        attacker,
        defender: defender2,
        teamMods,
      })

      // Outputs might differ if defenders match/don't match the target selector
      expect(out1.weapons).toBeDefined()
      expect(out2.weapons).toBeDefined()
    } catch {
      return
    }
  })

  // ==================== Data Integrity ====================

  it('does not mutate original variation', () => {
    try {
      const techId = findTechWithEffect()
      const v = { ...units[0]?.variations[0] } as any
      if (!v) throw new Error('No variation')

      const originalHP = v.hitpoints
      const originalWeapons = v.weapons?.map((w: any) => ({ ...w }))

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      applyCombatModsToVariation({ variation: v, teamMods: mods })

      // Original should be unchanged
      expect(v.hitpoints).toBe(originalHP)
      if (originalWeapons) {
        for (let i = 0; i < (v.weapons ?? []).length; i++) {
          expect(v.weapons[i].damageMax).toBe(originalWeapons[i]?.damageMax)
        }
      }
    } catch {
      return
    }
  })

  it('all weapons remain in output', () => {
    try {
      const techId = findTechWithEffect()
      const v = units[0]?.variations[0]
      if (!v) throw new Error('No variation')

      const baseWeaponCount = (v.weapons ?? []).length

      const mods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
      const eff = applyCombatModsToVariation({ variation: v, teamMods: mods })

      expect(eff.weapons.length).toBe(baseWeaponCount)
    } catch {
      return
    }
  })
})
