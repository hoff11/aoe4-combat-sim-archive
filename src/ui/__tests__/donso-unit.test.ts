import { describe, it } from 'vitest'
import { loadRawSnapshot } from '../../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../../data/canon/buildCanonUnits'

describe('Donso unit investigation', () => {
  it('shows donso weapons and classes', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)

    const donso = canonUnits.find((u) => u.id === 'donso')

    if (!donso) {
      console.log('Donso unit not found')
      return
    }

    console.log('\n=== DONSO ===')
    console.log(`Name: ${donso.name}`)
    console.log(`ID: ${donso.id}`)
    console.log(`Civs: ${donso.civs.join(', ')}`)
    console.log(`Classes: ${donso.classes.join(', ')}`)
    console.log(`Variations: ${donso.variations.length}`)

    if (donso.variations.length > 0) {
      const v = donso.variations[0]
      console.log(`\nFirst variation (${v.id}):`)
      console.log(`  Age: ${v.age}`)
      console.log(`  HP: ${v.hitpoints}`)
      console.log(`  Armor: M${v.armor.melee} / R${v.armor.ranged}`)
      console.log(`  Weapons (${v.weapons.length}):`)
      v.weapons.forEach((w) => {
        const dmg = w.damageMin
        const dps = (dmg / w.attackPeriod).toFixed(2)
        console.log(`    - ${w.name}`)
        console.log(`      Type: ${w.damageType}`)
        console.log(`      Damage: ${dmg}`)
        console.log(`      Attack Period: ${w.attackPeriod}s`)
        console.log(`      DPS: ${dps}`)
        console.log(`      Range: ${w.rangeMin} - ${w.rangeMax}`)
      })
    }
  })
})
