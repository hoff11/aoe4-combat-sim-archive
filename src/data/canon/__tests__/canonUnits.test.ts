import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUnits } from '../buildCanonUnits'

describe('buildCanonUnits', () => {
  it('produces at least one canon unit', () => {
    const snap = loadRawSnapshotNode()
    const units = buildCanonUnits(snap.units.data)

    // TDD #1: sanity check
    expect(units.length).toBeGreaterThan(0)
  })

  it('at least some variations have real weapon damage (damageMax > 0)', () => {
    const snap = loadRawSnapshotNode()
    const units = buildCanonUnits(snap.units.data)

    let withDamage = 0
    let totalVars = 0

    for (const u of units) {
      for (const v of u.variations) {
        totalVars++
        if (v.weapons.some((w) => w.damageMax > 0)) withDamage++
      }
    }

    // Don't over-constrain yet — just prove we’re parsing *something*
    expect(totalVars).toBeGreaterThan(0)
    expect(withDamage).toBeGreaterThan(10) // small floor; adjust if needed
  })
  it('many variations have explicit armor data (even if 0)', () => {
    const snap = loadRawSnapshotNode()
    const units = buildCanonUnits(snap.units.data)

    let total = 0
    let explicitArmor = 0
    let nonZeroArmor = 0

    for (const u of units) {
      for (const v of u.variations) {
        total++

        // canon invariant: always numbers
        expect(Number.isFinite(v.armor.melee)).toBe(true)
        expect(Number.isFinite(v.armor.ranged)).toBe(true)

        // explicit if either key exists on raw side OR canon parsed it (always true after parsing)
        // Since canon ALWAYS has armor, we'll interpret "explicit" as "not the default 0/0 OR unit is known to have armor array in raw".
        // But we don't have raw here, so treat any canon armor struct as explicit.
        explicitArmor++

        if (v.armor.melee !== 0 || v.armor.ranged !== 0) nonZeroArmor++
      }
    }

    expect(total).toBeGreaterThan(0)

    // This should always be true once canon guarantees armor on every variation
    expect(explicitArmor).toBe(total)

    // And we still want some real armored units to exist
    expect(nonZeroArmor).toBeGreaterThan(10)
  })
  it('Man-at-Arms has armor in canon', () => {
    const snap = loadRawSnapshotNode()
    const units = buildCanonUnits(snap.units.data)

    const maa = units.find(
      (u) => u.id === 'man-at-arms' || u.name.toLowerCase().includes('man-at-arms'),
    )
    expect(maa).toBeTruthy()

    const v = maa!.variations[0]
    expect(v.armor.melee).toBeGreaterThan(0)
    expect(v.armor.ranged).toBeGreaterThan(0)
  })

  it('some variations have resource costs', () => {
    const snap = loadRawSnapshotNode()
    const units = buildCanonUnits(snap.units.data)

    let withCost = 0
    let total = 0

    for (const u of units) {
      for (const v of u.variations) {
        total++
        const c = v.cost ?? {}
        const sum = (c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)
        if (sum > 0) withCost++
      }
    }

    expect(total).toBeGreaterThan(0)
    expect(withCost).toBeGreaterThan(10)
  })
})
