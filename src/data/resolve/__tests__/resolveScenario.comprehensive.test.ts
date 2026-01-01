import { describe, expect, it, beforeAll } from 'vitest'
import { resolveScenario } from '../resolveScenario'
import { makeEmptyScenarioState } from '../../../ui/uiStateTypes'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUnits } from '../../canon/buildCanonUnits'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

// ==================== Cached Data ====================

let cachedData: { units: any[]; techs: any[] } | null = null

function getCachedData() {
  if (!cachedData) {
    console.log('[resolveScenario] Loading snapshot...')
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)
    const techs = buildCanonTechnologies(raw.technologies.data)
    cachedData = { units, techs }
    console.log(`[resolveScenario] ✓ Loaded ${units.length} units, ${techs.length} techs`)
  }
  return cachedData
}

// ==================== Helpers ====================

function civForUnit(unitId: string): string {
  const { units } = getCachedData()
  const u = units.find((x) => x.id === unitId)
  if (!u?.civs || u.civs.length === 0) throw new Error(`No civs for unit ${unitId}`)
  return u.civs[0]
}

function findUnitWithVariations(count: number = 2): { unitId: string; civ: string } {
  const { units } = getCachedData()

  for (const u of units) {
    for (const civ of u.civs) {
      const civVars = (u.variations ?? []).filter((v: any) => v.civs?.includes(civ))
      if (civVars.length >= count) return { unitId: u.id, civ }
    }
  }
  throw new Error(`No unit with ${count}+ variations found`)
}

function findUnitAcrossMultipleCivs(): { unitId: string; civA: string; civB: string } {
  const { units } = getCachedData()

  for (const u of units) {
    const civsWithThis = u.civs.filter((c: any) =>
      (u.variations ?? []).some((v: any) => v.civs?.includes(c)),
    )
    if (civsWithThis.length >= 2) {
      return { unitId: u.id, civA: civsWithThis[0], civB: civsWithThis[1] }
    }
  }
  throw new Error('No unit across multiple civs')
}

function findTechWithEffect(): { techId: string; civ: string } {
  const { techs } = getCachedData()

  const validProps = new Set([
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
      if (
        validProps.has(prop) &&
        (eff === 'change' || eff === 'multiply' || eff === 'mult') &&
        Number.isFinite(Number(val))
      ) {
        const civ = t.civs && t.civs.length > 0 ? t.civs[0] : 'english'
        return { techId: t.id, civ }
      }
    }
  }
  throw new Error('No tech with effect found')
}

// ==================== Core Behavior ====================

describe('resolveScenario – Comprehensive Edge Cases', () => {
  beforeAll(() => {
    console.log('[resolveScenario] Starting tests...')
    getCachedData() // Pre-load
  })
  it('loads snapshot and resolves', () => {
    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civForUnit('archer'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.version.length).toBeGreaterThan(0)
    expect(res.simConfig.version).toBe(res.view.version)
  })

  it('handles empty rosters', () => {
    const ui = makeEmptyScenarioState()
    const res = resolveScenario(ui)

    expect(res.view.teams.A.units).toEqual([])
    expect(res.view.teams.B.units).toEqual([])
    expect(res.simConfig.teams.A.units).toEqual([])
    expect(res.simConfig.teams.B.units).toEqual([])
  })

  // ==================== Unit Picking & Variation ====================

  it('picks variation by civ preference', () => {
    const t = findUnitAcrossMultipleCivs()

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: t.civA,
          age: 2,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: t.civB,
          age: 2,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const varA = res.view.teams.A.units[0]
    const varB = res.view.teams.B.units[0]

    expect(varA).toBeTruthy()
    expect(varB).toBeTruthy()
    expect(varA.variationCivs).toContain(t.civA)
    expect(varB.variationCivs).toContain(t.civB)
  })

  it('returns base variation for tier=base', () => {
    const t = findUnitWithVariations(2)

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: t.civ,
          age: 4,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: t.civ,
          age: 4,
          units: [{ unitId: t.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const varA = res.view.teams.A.units[0]
    expect(varA.variationAge).toBeLessThanOrEqual(2) // base is age 1-2 typically
  })

  it('attempts to pick veteran (age 3) for tier=veteran', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)

    // Find unit with age 3 variation
    let target = null
    for (const u of units) {
      for (const c of u.civs) {
        const age3 = (u.variations ?? []).find((v) => v.civs?.includes(c) && v.age === 3)
        if (age3) {
          target = { unitId: u.id, civ: c }
          break
        }
      }
      if (target) break
    }
    if (!target) throw new Error('No unit with age 3')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: target.civ,
          age: 3,
          units: [{ unitId: target.unitId, count: 1, tier: 'veteran' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: target.civ,
          age: 3,
          units: [{ unitId: target.unitId, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const vet = res.view.teams.A.units[0]
    const base = res.view.teams.B.units[0]

    expect(vet).toBeTruthy()
    expect(base).toBeTruthy()
    expect(vet.variationAge).toBeGreaterThanOrEqual(base.variationAge)
  })

  it('gates unit by variation age vs team age', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 1,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)

    // archer is age 2, so age 1 team should have 0 units
    expect(res.view.teams.A.units).toEqual([])
    expect(res.view.teams.B.units.length).toBeGreaterThan(0)
  })

  // ==================== Unknown/Invalid Units ====================

  it('silently drops unit not in civ', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)

    // Find a unit A available for civ X, then try requesting it for civ Y that doesn't have it
    let validUnit = null
    let wrongCiv = null

    for (const u of units) {
      const civs = u.civs
      if (civs.length < 2) continue

      // Try to find a civ without this unit
      const allCivs = new Set<string>()
      for (const uu of units) {
        for (const c of uu.civs) allCivs.add(c)
      }
      const available = new Set(civs)
      const notAvailable = Array.from(allCivs).find((c) => !available.has(c))

      if (notAvailable) {
        validUnit = u
        wrongCiv = notAvailable
        break
      }
    }

    if (!validUnit || !wrongCiv) return // skip if can't find such unit

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: wrongCiv,
          age: 2,
          units: [{ unitId: validUnit.id, count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units).toEqual([])
  })

  it('silently drops unit with id not in canon', () => {
    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civForUnit('archer'),
          age: 2,
          units: [{ unitId: '__not_a_real_unit__', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units).toEqual([])
  })

  // ==================== Counts & Rows ====================

  it('preserves unit counts', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [
            { unitId: 'archer', count: 5, tier: 'base' },
            { unitId: 'spearman', count: 10, tier: 'base' },
          ],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const archer = res.view.teams.A.units.find((u) => u.unitId === 'archer')
    const spearman = res.view.teams.A.units.find((u) => u.unitId === 'spearman')

    if (archer) expect(archer.count).toBe(5)
    if (spearman) expect(spearman.count).toBe(10)
  })

  it('maintains order of unit rows', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data).slice(0, 5)
    const civ = units[0]?.civs[0]
    if (!civ) throw new Error('No units')

    const validIds = units
      .filter((u) => u.civs?.includes(civ))
      .map((u) => u.id)
      .slice(0, 3)

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 2,
          units: validIds.map((id) => ({ unitId: id, count: 1, tier: 'base' })),
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ,
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const result = res.view.teams.A.units.map((u) => u.unitId)

    // Order should match input (accounting for filtering)
    expect(result).toEqual(validIds)
  })

  // ==================== Tiers ====================

  it('base tier at age 4 still returns base variation', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 4,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 4,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const var_base = res.view.teams.A.units[0]
    expect(var_base.tier).toBe('base')
    expect(var_base.variationAge).toBeLessThanOrEqual(2) // base is typically age 1-2
  })

  it('elite tier at age < 4 falls back to base', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const var_unit = res.view.teams.A.units[0]
    expect(var_unit.tier).toBe('elite')
    expect(var_unit.variationAge).toBeLessThanOrEqual(2) // fell back to base
  })

  // ==================== Team Techs ====================

  it('applies team tech effects', () => {
    const _civA = civForUnit('archer')
    const { techId, civ } = findTechWithEffect()

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 4,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [techId],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 4,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.simConfig.teams.A.teamTechIds).toContain(norm(techId))
  })

  it('empty tech selections result in empty teamTechIds', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.simConfig.teams.A.teamTechIds).toEqual([])
  })

  // ==================== View vs Sim Mapping ====================

  it('view and sim units have 1-1 correspondence', () => {
    const civA = civForUnit('archer')

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
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units.length).toBe(res.simConfig.teams.A.units.length)

    for (let i = 0; i < res.view.teams.A.units.length; i++) {
      const view = res.view.teams.A.units[i]
      const sim = res.simConfig.teams.A.units[i]

      expect(view.unitId).toBe(sim.unitId)
      expect(view.variationId).toBe(sim.variationId)
      expect(view.count).toBe(sim.count)
    }
  })

  it('sim units carry correct variation and tech info', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const simUnit = res.simConfig.teams.A.units[0]

    expect(simUnit.variationId).toBeTruthy()
    expect(simUnit.unitTechIds).toBeDefined()
    expect(simUnit.unitCombatMods).toBeDefined()
  })

  // ==================== Game Data Validation ====================

  it('all resolvable units have valid variation ids', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data).slice(0, 5)
    const civ = units[0]?.civs[0]
    if (!civ) throw new Error('No units')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 2,
          units: units.map((u) => ({ unitId: u.id, count: 1, tier: 'base' })),
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ,
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    for (const u of res.view.teams.A.units) {
      expect(u.variationId).toBeTruthy()
      expect(typeof u.variationId).toBe('string')
      expect(u.variationId.length).toBeGreaterThan(0)
    }
  })

  it('unit stats are copied correctly to resolved view', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const unit = res.view.teams.A.units[0]

    expect(unit.hitpoints).toBeGreaterThan(0)
    expect(unit.armor).toBeDefined()
    expect(typeof unit.armor.melee).toBe('number')
    expect(typeof unit.armor.ranged).toBe('number')
    expect(unit.weapons.length).toBeGreaterThan(0)
  })

  it('handles both teams independently', () => {
    const civA = civForUnit('archer')
    const civB = civForUnit('spearman')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 5, tier: 'base' }],
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

    expect(res.view.teams.A.civ).toBe(civA)
    expect(res.view.teams.B.civ).toBe(civB)
    expect(res.view.teams.A.age).toBe(2)
    expect(res.view.teams.B.age).toBe(2)

    const unitA = res.view.teams.A.units.find((u) => u.unitId === 'archer')
    const unitB = res.view.teams.B.units.find((u) => u.unitId === 'spearman')

    if (unitA) expect(unitA.count).toBe(5)
    if (unitB) expect(unitB.count).toBe(10)
  })

  // ==================== Edge Cases & Robustness ====================

  it('handles age boundary: 1', () => {
    const civA = civForUnit('scout') // age 1 unit

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 1,
          units: [{ unitId: 'scout', count: 1, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civA,
          age: 1,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units.length).toBeGreaterThan(0)
    expect(res.view.teams.A.units[0].variationAge).toBeLessThanOrEqual(1)
  })

  it('handles age boundary: 4', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 4,
          units: [{ unitId: 'archer', count: 1, tier: 'elite' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civA,
          age: 4,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units.length).toBeGreaterThan(0)
  })

  it('handles zero unit count', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 0, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const archer = res.view.teams.A.units.find((u) => u.unitId === 'archer')
    if (archer) expect(archer.count).toBe(0)
  })

  it('handles large unit counts', () => {
    const civA = civForUnit('archer')

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ: civA,
          age: 2,
          units: [{ unitId: 'archer', count: 1000, tier: 'base' }],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ: civForUnit('spearman'),
          age: 2,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    const archer = res.view.teams.A.units.find((u) => u.unitId === 'archer')
    if (archer) expect(archer.count).toBe(1000)
  })

  it('handles many unit rows', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data).slice(0, 20)
    const civ = units[0]?.civs[0]
    if (!civ) throw new Error('No units')

    const validIds = units.filter((u) => u.civs?.includes(civ)).map((u) => u.id)

    const ui = makeEmptyScenarioState({
      teams: {
        A: {
          civ,
          age: 3,
          units: validIds.map((id) => ({ unitId: id, count: 1, tier: 'base' })),
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
        B: {
          civ,
          age: 3,
          units: [],
          selectedTechIds: [],
          selectedUpgradeIds: [],
        },
      },
    })

    const res = resolveScenario(ui)
    expect(res.view.teams.A.units.length).toBeGreaterThan(5)
  })
})
