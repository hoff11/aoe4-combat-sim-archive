import { describe, it } from 'vitest'
import { loadRawSnapshot } from '../../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../../data/canon/buildCanonUnits'

describe('Find hybrid units (multiple weapons)', () => {
  it('lists units with 2+ weapons and their weapon types', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)

    const hybridUnits = canonUnits.filter((u) => {
      const vars = u.variations.filter((v) => v.weapons.length >= 2)
      return vars.length > 0
    })

    console.log(`\nFound ${hybridUnits.length} units with multiple weapons:\n`)

    hybridUnits.slice(0, 15).forEach((u) => {
      const variation = u.variations[0]
      if (variation && variation.weapons.length >= 2) {
        console.log(`${u.name} (${u.id})`)
        console.log(`  Classes: ${u.classes.join(', ')}`)
        console.log(`  Weapons:`)
        variation.weapons.forEach((w) => {
          const dmg = w.damageMin
          const dps = (dmg / w.attackPeriod).toFixed(2)
          console.log(
            `    - ${w.name} (${w.damageType}): ${dmg} dmg, ${w.attackPeriod}s → ${dps} DPS`,
          )
        })
        console.log()
      }
    })

    // Specifically check javelin-thrower
    const javelin = canonUnits.find((u) => u.id === 'javelin-thrower')
    if (javelin && javelin.variations.length > 0) {
      console.log('\n=== JAVELIN THROWER DETAIL ===')
      const v = javelin.variations[0]
      console.log(`Classes: ${javelin.classes.join(', ')}`)
      console.log(`Weapons (${v.weapons.length}):`)
      v.weapons.forEach((w) => {
        const dmg = w.damageMin
        const dps = (dmg / w.attackPeriod).toFixed(2)
        console.log(`  - ${w.name}`)
        console.log(`    Type: ${w.damageType}`)
        console.log(`    Damage: ${dmg}`)
        console.log(`    Attack Period: ${w.attackPeriod}s`)
        console.log(`    DPS: ${dps}`)
        console.log(`    Range: ${w.rangeMin} - ${w.rangeMax}`)
      })
    }
  })
})
