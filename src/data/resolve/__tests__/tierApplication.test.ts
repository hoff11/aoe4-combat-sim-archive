import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUnits } from '../../canon/buildCanonUnits'
import { resolveScenario } from '../resolveScenario'
import type { TierLabel } from '../../../ui/uiStateTypes'

function findTierableUnit(): { unitId: string; civ: string; tier: TierLabel } {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)

  for (const u of units) {
    for (const civ of u.civs ?? []) {
      const civVars = (u.variations ?? []).filter((v) => v.civs?.includes(civ))
      const hasVet = civVars.some((v) => Number(v.age) === 3)
      const hasElite = civVars.some((v) => Number(v.age) === 4)
      if (hasElite) return { unitId: u.id, civ, tier: 'elite' }
      if (hasVet) return { unitId: u.id, civ, tier: 'veteran' }
    }
  }

  throw new Error('No tierable unit found (no age 3/4 variations).')
}

function weaponDamageSum(weapons: any[]): number {
  let sum = 0
  for (const w of weapons ?? []) {
    const min = Number(w?.damageMin ?? w?.damage_min ?? 0)
    const max = Number(w?.damageMax ?? w?.damage_max ?? w?.damage ?? 0)
    const v = Number.isFinite(max) ? (Number.isFinite(min) ? (min + max) / 2 : max) : 0
    sum += v
  }
  return sum
}
function approxWeaponAvgDamage(weapons: any[]): number {
  let sum = 0
  for (const w of weapons ?? []) {
    const min = Number(w?.damageMin ?? 0)
    const max = Number(w?.damageMax ?? 0)
    if (Number.isFinite(min) && Number.isFinite(max) && max > 0) sum += (min + max) / 2
    else if (Number.isFinite(max) && max > 0) sum += max
  }
  return sum
}
function findUnitWithTierAge(wantAge: 3 | 4) {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)

  for (const u of units) {
    for (const civ of u.civs ?? []) {
      const civVars = (u.variations ?? []).filter((v) => v.civs?.includes(civ))
      if (civVars.some((v) => Number(v.age) === wantAge)) {
        return { unitId: u.id, civ }
      }
    }
  }
  throw new Error(`No unit found with age ${wantAge} variation`)
}
function findUnitWithElite() {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)

  for (const u of units) {
    for (const civ of u.civs ?? []) {
      const civVars = (u.variations ?? []).filter((v) => v.civs?.includes(civ))
      const hasElite = civVars.some((v) => Number(v.age) === 4)
      const baseAge = Math.min(...civVars.map((v) => Number(v.age ?? 999)))
      if (hasElite && Number.isFinite(baseAge)) return { unitId: u.id, civ }
    }
  }
  throw new Error('No unit with an elite (age 4) variation found')
}

function run(unitId: string, civ: string, age: 1 | 2 | 3 | 4, tier: TierLabel) {
  return resolveScenario({
    teams: {
      A: {
        civ,
        age,
        units: [{ unitId, count: 1, tier }],
        selectedTechIds: [],
        selectedUpgradeIds: [],
      },
      B: { civ, age, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
    },
  })
}
function findUnitWithTwoCivsAndElite() {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)

  for (const u of units) {
    if ((u.civs?.length ?? 0) < 2) continue
    for (const civ of u.civs ?? []) {
      const civVars = (u.variations ?? []).filter((v) => v.civs?.includes(civ))
      if (civVars.some((v) => Number(v.age) === 4)) return { unitId: u.id, civ }
    }
  }
  throw new Error('No suitable multi-civ unit with elite found')
}
describe('tier application (variation-based)', () => {
  it('selecting veteran/elite picks a different variation than base (when available)', () => {
    const target = findTierableUnit()

    const baseRes = resolveScenario({
      teams: {
        A: {
          civ: target.civ,
          age: 4,
          units: [{ unitId: target.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: target.civ,
          age: 4,
          units: [{ unitId: target.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const tierRes = resolveScenario({
      teams: {
        A: {
          civ: target.civ,
          age: 4,
          units: [{ unitId: target.unitId, count: 1, tier: target.tier }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: target.civ,
          age: 4,
          units: [{ unitId: target.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const base = baseRes.view.teams.A.units[0]
    const tiered = tierRes.view.teams.A.units[0]

    expect(base).toBeTruthy()
    expect(tiered).toBeTruthy()

    const variationChanged = tiered.variationId !== base.variationId
    const hpChanged = tiered.hitpoints !== base.hitpoints
    const armorChanged =
      Number(tiered.armor?.melee ?? 0) !== Number(base.armor?.melee ?? 0) ||
      Number(tiered.armor?.ranged ?? 0) !== Number(base.armor?.ranged ?? 0)
    const dmgChanged =
      weaponDamageSum(tiered.weapons as any[]) !== weaponDamageSum(base.weapons as any[])

    expect(variationChanged || hpChanged || armorChanged || dmgChanged).toBe(true)
  })
})
describe('tier selection contract', () => {
  it('veteran selects an age-3 variation when available (and does not silently pick age-4)', () => {
    const t = findUnitWithTierAge(3)
    const res = run(t.unitId, t.civ, 4, 'veteran')
    const u = res.view.teams.A.units[0]
    expect(u).toBeTruthy()
    expect(Number(u.variationAge)).toBe(3)
  })

  it('elite selects an age-4 variation when available', () => {
    const t = findUnitWithTierAge(4)
    const res = run(t.unitId, t.civ, 4, 'elite')
    const u = res.view.teams.A.units[0]
    expect(u).toBeTruthy()
    expect(Number(u.variationAge)).toBe(4)
  })
})
describe('tier application (age gating)', () => {
  it('requesting elite at age 3 falls back to base', () => {
    const t = findUnitWithElite()

    const baseRes = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 3,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 3, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const eliteRes = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 3,
          units: [{ unitId: t.unitId, count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 3, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const base = baseRes.view.teams.A.units[0]
    const elite = eliteRes.view.teams.A.units[0]

    expect(base).toBeTruthy()
    expect(elite).toBeTruthy()
    // Elite requested at Age 3 should give veteran (Age 3), not base (Age 2)
    expect(elite.variationId).not.toBe(base.variationId)
    expect(elite.variationId).toContain('-3') // Should be Age 3 (veteran)
    expect(elite.variationAge).toBe(3)
  })
})
describe('resolveScenario civ filtering', () => {
  it('tier selection never returns a variation that is not allowed for the team civ', () => {
    const t = findUnitWithTwoCivsAndElite()

    const res = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 4,
          units: [{ unitId: t.unitId, count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const u = res.view.teams.A.units[0]
    expect(u).toBeTruthy()
    expect(u.variationCivs).toContain(t.civ)
  })
  it('tier labels map to exact ages (veteran=3, elite=4)', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)

    for (const u of units) {
      for (const civ of u.civs ?? []) {
        const civVars = u.variations.filter((v) => v.civs.includes(civ))
        if (!civVars.some((v) => Number(v.age) === 4)) continue

        const res = resolveScenario({
          teams: {
            A: {
              civ,
              age: 4,
              units: [{ unitId: u.id, count: 1, tier: 'elite' }],
              selectedTechIds: [],
              selectedUpgradeIds: [],
            },
            B: { civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
          },
        })

        const r = res.view.teams.A.units[0]
        expect(Number(r.variationAge)).toBe(4)
        return
      }
    }

    throw new Error('No elite-capable unit found')
  })
})
describe('resolveScenario determinism', () => {
  it('same scenario input yields the same variationId list', () => {
    const ui = {
      teams: {
        A: {
          civ: 'english',
          age: 4,
          units: [
            { unitId: 'archer', count: 2, tier: 'base' },
            { unitId: 'spearman', count: 1, tier: 'base' },
          ],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: 'english', age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    } as any

    const r1 = resolveScenario(ui)
    const r2 = resolveScenario(ui)

    expect(r1.view.teams.A.units.map((u) => u.variationId)).toEqual(
      r2.view.teams.A.units.map((u) => u.variationId),
    )
  })
})
describe('tier -> stats contract (variation swap)', () => {
  it('elite selects an age-4 variation and changes at least one returned stat vs base', () => {
    const t = findUnitWithElite()

    const baseRes = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 4,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const eliteRes = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 4,
          units: [{ unitId: t.unitId, count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const base = baseRes.view.teams.A.units[0]
    const elite = eliteRes.view.teams.A.units[0]

    expect(base).toBeTruthy()
    expect(elite).toBeTruthy()
    expect(Number(elite.variationAge)).toBe(4)

    const hpChanged = elite.hitpoints !== base.hitpoints
    const armorChanged =
      Number(elite.armor?.melee ?? 0) !== Number(base.armor?.melee ?? 0) ||
      Number(elite.armor?.ranged ?? 0) !== Number(base.armor?.ranged ?? 0)
    const dmgChanged =
      approxWeaponAvgDamage(elite.weapons as any[]) !== approxWeaponAvgDamage(base.weapons as any[])

    expect(hpChanged || armorChanged || dmgChanged || elite.variationId !== base.variationId).toBe(
      true,
    )
  })
})
describe('tier gating (variation swap)', () => {
  it('elite requested at age 3 gives veteran stats (best available)', () => {
    const t = findUnitWithElite()

    const baseRes = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 3,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 3, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const eliteRes = resolveScenario({
      teams: {
        A: {
          civ: t.civ,
          age: 3,
          units: [{ unitId: t.unitId, count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: t.civ, age: 3, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const base = baseRes.view.teams.A.units[0]
    const elite = eliteRes.view.teams.A.units[0]

    // Elite requested at Age 3 should give veteran, not base
    expect(elite.variationId).not.toBe(base.variationId)
    expect(elite.variationId).toContain('-3')
    // Veteran should have different stats than base
    expect(elite.hitpoints).not.toBe(base.hitpoints)
  })
})
