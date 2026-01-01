import { describe, expect, it } from 'vitest'
import { buildCanonUnits } from '../buildCanonUnits'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'

describe('Unique buildings that should be exposed in UI', () => {
  it('should identify unique buildings that produce units with different costs than standard buildings', () => {
    const raw = loadRawSnapshotNode()
    const canonUnits = buildCanonUnits(raw.units.data)

    const standardBuildings = [
      'barracks',
      'archery-range',
      'stable',
      'siege-workshop',
      'dock',
      'town-center',
      'monastery',
      'market',
      'keep',
    ]

    // Map of unique building -> units it produces
    const uniqueBuildingUnits = new Map<
      string,
      Array<{
        unit: string
        age: number
        civ: string
        cost?: any
        hasStandardAlternative: boolean
      }>
    >()

    for (const unit of canonUnits) {
      for (const variation of unit.variations) {
        const buildings = variation.producedBy || []
        const uniqueBuildings = buildings.filter((b) => !standardBuildings.includes(b))

        if (uniqueBuildings.length > 0) {
          // This unit is produced by a unique building
          const hasStandardBuilding = buildings.some((b) => standardBuildings.includes(b))

          for (const building of uniqueBuildings) {
            if (!uniqueBuildingUnits.has(building)) {
              uniqueBuildingUnits.set(building, [])
            }

            uniqueBuildingUnits.get(building)!.push({
              unit: unit.name,
              age: variation.age ?? 1,
              civ: variation.civs?.[0] || '?',
              cost: variation.cost,
              hasStandardAlternative: hasStandardBuilding,
            })
          }
        }
      }
    }

    console.log('\n=== Unique Buildings Analysis ===\n')

    const mercenaryBuildings: string[] = []
    const exclusiveBuildings: string[] = []
    const duplicateBuildings: string[] = []

    for (const [building, units] of Array.from(uniqueBuildingUnits.entries()).sort()) {
      const mercenaryUnits = units.filter((u) => !u.cost)
      const exclusiveUnits = units.filter((u) => !u.hasStandardAlternative)
      const duplicateUnits = units.filter((u) => u.hasStandardAlternative)

      console.log(`\n${building}:`)
      console.log(`  Total units: ${units.length}`)
      console.log(`  Mercenary units (no cost): ${mercenaryUnits.length}`)
      console.log(`  Exclusive units (no standard alternative): ${exclusiveUnits.length}`)
      console.log(
        `  Duplicate units (also available from standard building): ${duplicateUnits.length}`,
      )

      if (mercenaryUnits.length > 0) {
        console.log(
          `  Mercenaries: ${mercenaryUnits
            .slice(0, 3)
            .map((u) => u.unit)
            .join(', ')}${mercenaryUnits.length > 3 ? '...' : ''}`,
        )
        if (!mercenaryBuildings.includes(building)) mercenaryBuildings.push(building)
      }

      if (exclusiveUnits.length > 0) {
        console.log(
          `  Exclusive: ${exclusiveUnits
            .slice(0, 3)
            .map((u) => u.unit)
            .join(', ')}${exclusiveUnits.length > 3 ? '...' : ''}`,
        )
        if (!exclusiveBuildings.includes(building)) exclusiveBuildings.push(building)
      }

      if (duplicateUnits.length > 0 && mercenaryUnits.length === 0) {
        if (!duplicateBuildings.includes(building)) duplicateBuildings.push(building)
      }
    }

    console.log('\n=== Recommendations ===')
    console.log('\nMERCENARY BUILDINGS (should be exposed - different costs):')
    mercenaryBuildings.forEach((b) => console.log(`  - ${b}`))

    console.log('\nEXCLUSIVE BUILDINGS (could be exposed - unique units):')
    exclusiveBuildings
      .filter((b) => !mercenaryBuildings.includes(b))
      .forEach((b) => console.log(`  - ${b}`))

    console.log('\nDUPLICATE BUILDINGS (can be hidden - same units as standard buildings):')
    duplicateBuildings.forEach((b) => console.log(`  - ${b}`))

    // Mercenary buildings should exist
    expect(mercenaryBuildings.length).toBeGreaterThan(0)
  })
})
