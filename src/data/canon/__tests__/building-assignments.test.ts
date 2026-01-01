import { describe, expect, it } from 'vitest'
import { buildCanonUnits } from '../buildCanonUnits'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'

describe('Cavalry units building assignment', () => {
  it('should assign all cavalry units to stable, not barracks', () => {
    const raw = loadRawSnapshotNode()
    const canonUnits = buildCanonUnits(raw.units.data)

    // Find all units with cavalry classes
    const cavalryUnits = canonUnits.filter((u) =>
      u.classes.some((c) => c.includes('cavalry') || c.includes('horse')),
    )

    console.log(`Found ${cavalryUnits.length} cavalry units`)

    // Check each cavalry unit's variations
    const problematicUnits: Array<{ unit: string; variation: string; producedBy: string[] }> = []

    for (const unit of cavalryUnits) {
      for (const variation of unit.variations) {
        const hasBarracks = variation.producedBy?.includes('barracks')
        const hasStable = variation.producedBy?.includes('stable')

        if (hasBarracks && !hasStable) {
          // Cavalry in barracks but not stable is wrong
          problematicUnits.push({
            unit: unit.name,
            variation: variation.name,
            producedBy: variation.producedBy || [],
          })
        }
      }
    }

    if (problematicUnits.length > 0) {
      console.log('Cavalry units incorrectly assigned to barracks:')
      problematicUnits.forEach((p) => {
        console.log(`  - ${p.unit} (${p.variation}): ${p.producedBy.join(', ')}`)
      })
    }

    expect(problematicUnits.length).toBe(0)
  })

  it('should not assign siege units to stable or archery-range based on substring matches', () => {
    const raw = loadRawSnapshotNode()
    const canonUnits = buildCanonUnits(raw.units.data)

    // Find units with 'siege' as exact class (not substring like find_non_siege_land_military)
    // Exclude transport units as their producedBy lists units that can garrison, not buildings
    const siegeUnits = canonUnits.filter(
      (u) =>
        u.classes.some((c) => c === 'siege' || c === 'siege_workshop') &&
        !u.classes.some((c) => c === 'transport'),
    )

    console.log(`Found ${siegeUnits.length} siege units`)

    // Check each siege unit's variations
    const problematicUnits: Array<{ unit: string; classes: string[]; producedBy: string[] }> = []

    for (const unit of siegeUnits) {
      // Get the first variation's producedBy as representative
      const producedBy = unit.variations[0]?.producedBy || []
      const hasStable = producedBy.includes('stable')
      const hasArchery = producedBy.includes('archery-range')
      const hasSiege = producedBy.includes('siege-workshop')

      if ((hasStable || hasArchery) && !hasSiege) {
        // Siege unit in wrong building
        problematicUnits.push({
          unit: unit.name,
          classes: unit.classes,
          producedBy,
        })
      }
    }

    if (problematicUnits.length > 0) {
      console.log('Siege units incorrectly assigned:')
      problematicUnits.forEach((p) => {
        console.log(`  - ${p.unit}: ${p.producedBy.join(', ')} (classes: ${p.classes.join(', ')})`)
      })
    }

    expect(problematicUnits.length).toBe(0)
  })
})
