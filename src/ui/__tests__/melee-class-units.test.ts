import { describe, it } from 'vitest'
import { loadRawSnapshot } from '../../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../../data/canon/buildCanonUnits'

describe('Find units with melee class', () => {
  it('lists all units with "melee" in their classes array', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)

    const meleeUnits = canonUnits.filter((u) => u.classes.includes('melee'))

    console.log(`\nFound ${meleeUnits.length} units with 'melee' class:\n`)
    meleeUnits.slice(0, 10).forEach((u) => {
      console.log(`${u.name} (${u.id})`)
      console.log(`  Classes: ${u.classes.join(', ')}`)
      if (u.variations.length > 0) {
        const v = u.variations[0]
        console.log(`  Weapons: ${v.weapons.map((w) => `${w.name} (${w.damageType})`).join(', ')}`)
      }
      console.log()
    })
  })
})
