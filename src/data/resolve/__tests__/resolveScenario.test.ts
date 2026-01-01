import { describe, it, expect } from 'vitest'
import { resolveScenario } from '../resolveScenario'
import { makeEmptyScenarioState } from '../../../ui/uiStateTypes'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUnits } from '../../canon/buildCanonUnits'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'
import { buildCanonUpgrades } from '../../canon/buildCanonUpgrades'

function civForUnit(unitId: string): string {
  const raw = loadRawSnapshotNode()
  const canonUnits = buildCanonUnits(raw.units.data)
  const u = canonUnits.find((x) => x.id === unitId)
  if (!u || !u.civs || u.civs.length === 0) {
    throw new Error(`No civs found for unitId=${unitId}`)
  }
  return u.civs[0]
}

function findUnitWithMultipleAges() {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)

  for (const u of units) {
    for (const civ of u.civs ?? []) {
      const civVars = (u.variations ?? []).filter((v) => v.civs?.includes(civ))
      const ages = new Set(civVars.map((v) => Number(v.age)))
      if (ages.has(2) && (ages.has(3) || ages.has(4))) return { unitId: u.id, civ }
    }
  }
  throw new Error('No multi-tier unit found')
}

/**
 * Find a tech id that will produce at least one combat effect under our parser:
 * looks for any effect.raw with { property, effect, value } where property is one of the known combat stats.
 * Returns both the tech ID and a compatible civ.
 */
function findTechIdWithCombatEffect(): { techId: string; civ: string } {
  const raw = loadRawSnapshotNode()
  const techs = buildCanonTechnologies(raw.technologies.data)

  const okProps = new Set([
    'meleeAttack',
    'rangedAttack',
    'siegeAttack',
    'meleeArmor',
    'rangedArmor',
    'hitpoints',
    'attackSpeed',
    'range',
    'maxRange',
  ])

  for (const t of techs) {
    for (const e of t.effects ?? []) {
      const r: any = (e as any).raw
      const prop = String(r?.property ?? '')
      const eff = String(r?.effect ?? '')
      const val = r?.value
      if (
        okProps.has(prop) &&
        (eff === 'change' || eff === 'multiply' || eff === 'mult') &&
        Number.isFinite(Number(val))
      ) {
        // Found a tech with combat effects
        const civ = t.civs && t.civs.length > 0 ? t.civs[0] : 'english'
        return { techId: t.id, civ }
      }
    }
  }
  throw new Error('No technology with a parsable combat effect found in snapshot')
}

describe('resolveScenario (Phase A)', () => {
  it('returns view + simConfig with resolved variation ids', () => {
    const civA = civForUnit('archer')
    const civB = civForUnit('spearman')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 10, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civB,
          age: 2,
          units: [{ unitId: 'spearman', count: 10, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)

    expect(res.view.version.length).toBeGreaterThan(0)
    expect(res.view.teams.A.units.length).toBeGreaterThan(0)
    expect(res.view.teams.B.units.length).toBeGreaterThan(0)

    expect(res.view.teams.A.units[0].variationId.length).toBeGreaterThan(0)
    expect(res.simConfig.teams.A.units[0].variationId.length).toBeGreaterThan(0)
  })

  it('does not pick a variation above team age', () => {
    const civ = civForUnit('scout')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 1,
          units: [{ unitId: 'scout', count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ,
          age: 1,
          units: [{ unitId: 'scout', count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const a = res.view.teams.A.units[0]
    expect(a).toBeTruthy()

    expect(a.variationId.length).toBeGreaterThan(0)
    expect(a.variationAge).toBeLessThanOrEqual(1)
    expect(a.unitCivs).toContain(civ)
  })

  it('filters variations by civ when possible', () => {
    const raw = loadRawSnapshotNode()
    const canonUnits = buildCanonUnits(raw.units.data)
    const archer = canonUnits.find((u) => u.id === 'archer')!
    expect(archer.civs.length).toBeGreaterThan(1)

    const civ1 = archer.civs[0]
    const civ2 = archer.civs[1]

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civ1,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civ2,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units.length).toBeGreaterThan(0)
    expect(res.view.teams.B.units.length).toBeGreaterThan(0)
  })

  it('filters out units that are not unlocked at the team age (base variation age > team age)', () => {
    const civ = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 1,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units.length).toBe(0)
    expect(res.view.teams.B.units.length).toBeGreaterThan(0)
  })
})

describe('resolveScenario tier defaults', () => {
  it('age does not imply tier: base remains lowest-age even at age 4', () => {
    const t = findUnitWithMultipleAges()

    const res = resolveScenario({
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
    } as any)

    const u = res.view.teams.A.units[0]
    expect(u).toBeTruthy()
    expect(Number(u.variationAge)).toBeLessThan(3)
  })
})

describe('resolveScenario simConfig integrity (new shape)', () => {
  it('simConfig unit groups match view variationIds + counts (for resolved rows)', () => {
    const ui = {
      teams: {
        A: {
          civ: 'english',
          age: 4,
          units: [
            { unitId: 'archer', count: 7, tier: 'base' },
            { unitId: 'spearman', count: 3, tier: 'base' },
          ],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ: 'english', age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    } as any

    const res = resolveScenario(ui)

    const viewA = res.view.teams.A.units.map((u) => ({
      unitId: u.unitId,
      variationId: u.variationId,
      count: u.count,
    }))
    const simA = res.simConfig.teams.A.units.map((u) => ({
      unitId: u.unitId,
      variationId: u.variationId,
      count: u.count,
    }))

    expect(simA).toEqual(viewA)
  })

  it('teamTechIds passthrough and teamCombatMods include at least one effect for a combat-tech', () => {
    const { techId, civ } = findTechIdWithCombatEffect()

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 4,
          units: [{ unitId: 'spearman', count: 5, tier: 'base' }],
          selectedTechIds: [techId],
          selectedUpgradeIds: [],
        },
        B: { civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const res = resolveScenario(ui)
    expect(res.simConfig.teams.A.teamTechIds).toContain(techId)

    const effects = res.simConfig.teams.A.teamCombatMods.effects
    expect(effects.length).toBeGreaterThan(0)
    expect(effects.some((e) => e.sourceId === techId)).toBe(true)
  })

  it('unitTech toggles passthrough and unitCombatMods include effects when enabled', () => {
    const { techId, civ } = findTechIdWithCombatEffect()
    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 4,
          units: [
            {
              unitId: 'spearman',
              count: 2,
              tier: 'base',
              unitTechs: [
                { id: techId, enabled: false },
                { id: techId, enabled: true },
              ],
            },
          ],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const res = resolveScenario(ui)
    expect(res.simConfig.teams.A.units.length).toBe(1) // ✅ guard
    const g = res.simConfig.teams.A.units[0]
    expect(g.unitTechIds).toEqual([techId])

    expect(g.unitCombatMods.effects.length).toBeGreaterThan(0)
    expect(g.unitCombatMods.effects.some((e) => e.sourceId === techId)).toBe(true)
  })

  it('row filtering does not desync unitTechIds (no index-based mapping regression)', () => {
    const { techId, civ } = findTechIdWithCombatEffect()
    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 4,
          units: [
            {
              unitId: '__does_not_exist__',
              count: 1,
              tier: 'base',
              unitTechs: [{ id: techId, enabled: true }],
            },
            {
              unitId: 'spearman',
              count: 1,
              tier: 'base',
              unitTechs: [{ id: techId, enabled: true }],
            },
          ],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: { civ, age: 4, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
    })

    const res = resolveScenario(ui)

    expect(res.view.teams.A.units.length).toBe(1)
    expect(res.simConfig.teams.A.units.length).toBe(1)

    expect(res.simConfig.teams.A.units[0].unitId).toBe('spearman')
    expect(res.simConfig.teams.A.units[0].unitTechIds).toEqual([techId])
  })
})

describe('buildCanonUnits weapon invariants', () => {
  it('every variation has at least one weapon and attackPeriod is finite', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)

    let checked = 0
    for (const u of units) {
      for (const v of u.variations) {
        expect(v.weapons.length).toBeGreaterThan(0)
        for (const w of v.weapons as any[]) {
          expect(Number.isFinite(Number(w.attackPeriod ?? w.speed ?? 0))).toBe(true)
        }
        checked++
        if (checked > 200) break
      }
      if (checked > 200) break
    }
  })
})

describe('tier upgrades are metadata only', () => {
  it('tier-like upgrades do not carry hitpoints/armor/weapons payloads', () => {
    const raw = loadRawSnapshotNode()
    const ups = buildCanonUpgrades(raw.upgrades.data)

    const tierish = ups.filter((u) =>
      /upgrade to (veteran|elite|hardened)/i.test(String((u as any).name ?? (u as any).id)),
    )

    for (const u of tierish as any[]) {
      for (const v of (u.variations ?? []) as any[]) {
        const rv = v.raw ?? {}
        expect(rv.hitpoints).toBeUndefined()
        expect(rv.armor).toBeUndefined()
        expect(rv.weapons).toBeUndefined()
      }
    }
  })
})
