import { describe, expect, it } from 'vitest'
import { buildCanonUnits } from '../buildCanonUnits'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'

describe('Unit cost variations', () => {
  it('should identify units with different costs across variations for same civ/age', () => {
    const raw = loadRawSnapshotNode()
    const canonUnits = buildCanonUnits(raw.units.data)

    const unitsWithCostDifferences: Array<{
      unit: string
      age: number
      variations: Array<{ civ?: string; cost?: any; producedBy?: string[] }>
    }> = []

    for (const unit of canonUnits) {
      // Group variations by age
      const byAge = new Map<number, typeof unit.variations>()
      for (const v of unit.variations) {
        const age = v.age ?? 1
        if (!byAge.has(age)) byAge.set(age, [])
        byAge.get(age)!.push(v)
      }

      // Check each age group for cost differences
      for (const [age, variations] of byAge) {
        const costs = variations.map((v) => JSON.stringify(v.cost || null))
        const uniqueCosts = new Set(costs)

        if (uniqueCosts.size > 1) {
          // Multiple different costs for same age
          unitsWithCostDifferences.push({
            unit: unit.name,
            age,
            variations: variations.map((v) => ({
              civ: v.civs?.[0],
              cost: v.cost,
              producedBy: v.producedBy,
            })),
          })
        }
      }
    }

    console.log(`\nFound ${unitsWithCostDifferences.length} units with cost variations:`)
    unitsWithCostDifferences.forEach(({ unit, age, variations }) => {
      console.log(`\n  ${unit} (Age ${age}):`)
      variations.forEach((v) => {
        const costStr = v.cost
          ? `${v.cost.food || 0}f ${v.cost.wood || 0}w ${v.cost.gold || 0}g ${v.cost.oliveoil || 0}oil`
          : 'undefined'
        console.log(`    - ${v.civ || '?'}: ${costStr} [${v.producedBy?.join(', ') || 'none'}]`)
      })
    })

    // This is informational - we expect some units to have cost differences (mercenaries)
    expect(unitsWithCostDifferences.length).toBeGreaterThan(0)
  })
})
