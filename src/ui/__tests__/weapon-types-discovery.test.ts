// Quick test to list all weapon types
import { describe, it, expect } from 'vitest'
import { loadRawSnapshot } from '../../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../../data/canon/buildCanonUnits'

describe('Weapon Type Discovery', () => {
  it('should list all weapon damage types', () => {
    const raw = loadRawSnapshot()
    const units = buildCanonUnits(raw.units.data)

    // Check desert raider's weapons in detail
    const desertRaider = units.find((u) => u.id === 'desert-raider')
    if (desertRaider) {
      console.log('\n🔍 Desert Raider weapons:')
      const variation = desertRaider.variations[0]
      variation.weapons?.forEach((w, i) => {
        console.log(
          `   [${i}] ${w.name} (${w.damageType}):`,
          JSON.stringify(w, null, 2).substring(0, 200),
        )
      })
    }

    const weaponTypes = new Set<string>()
    const examplesByType = new Map<string, string[]>()

    for (const unit of units) {
      for (const variation of unit.variations) {
        for (const weapon of variation.weapons || []) {
          if (weapon.damageType) {
            weaponTypes.add(weapon.damageType)
            if (!examplesByType.has(weapon.damageType)) {
              examplesByType.set(weapon.damageType, [])
            }
            const examples = examplesByType.get(weapon.damageType)!
            if (examples.length < 3 && !examples.includes(unit.id)) {
              examples.push(`${unit.id} (${weapon.name})`)
            }
          }
        }
      }
    }

    const sortedTypes = Array.from(weaponTypes).sort()
    console.log('\n🎯 Found weapon damage types:', sortedTypes.join(', '))
    console.log('\n📋 Details with examples:')
    sortedTypes.forEach((type) => {
      const unitsWithType = units.filter((u) =>
        u.variations.some((v) => v.weapons?.some((w) => w.damageType === type)),
      )
      console.log(`\n   ${type}: ${unitsWithType.length} units`)
      const examples = examplesByType.get(type) || []
      examples.forEach((ex) => console.log(`      - ${ex}`))
    })

    expect(weaponTypes.size).toBeGreaterThan(0)
  })
})
