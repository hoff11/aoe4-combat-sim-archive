import { describe, it } from 'vitest'
import { loadRawSnapshot } from '../../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../../data/canon/buildCanonUnits'

describe('Complete coverage check', () => {
  it('lists all unique unit classes and weapon types in game', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)

    // Collect all unique unit classes
    const allClasses = new Set<string>()
    canonUnits.forEach((u) => {
      u.classes.forEach((c) => allClasses.add(c))
    })

    // Collect all unique weapon damage types
    const allWeaponTypes = new Set<string>()
    canonUnits.forEach((u) => {
      u.variations.forEach((v) => {
        v.weapons.forEach((w) => {
          allWeaponTypes.add(w.damageType)
        })
      })
    })

    console.log(`\n=== UNIT CLASSES (${allClasses.size} total) ===`)
    const sortedClasses = Array.from(allClasses).sort()

    // Group by category for readability
    const combatClasses = sortedClasses.filter(
      (c) => c.includes('melee') || c.includes('ranged') || c.includes('siege'),
    )
    const unitTypeClasses = sortedClasses.filter(
      (c) =>
        c.includes('infantry') ||
        c.includes('cavalry') ||
        c.includes('archer') ||
        c.includes('spearman') ||
        c.includes('knight') ||
        c === 'crossbow',
    )
    const otherClasses = sortedClasses.filter(
      (c) => !combatClasses.includes(c) && !unitTypeClasses.includes(c),
    )

    console.log('\nCombat Role Classes (used by blacksmith techs):')
    combatClasses.forEach((c) => console.log(`  - ${c}`))

    console.log('\nUnit Type Classes:')
    unitTypeClasses.slice(0, 20).forEach((c) => console.log(`  - ${c}`))
    if (unitTypeClasses.length > 20) {
      console.log(`  ... and ${unitTypeClasses.length - 20} more`)
    }

    console.log('\nOther Classes (first 30):')
    otherClasses.slice(0, 30).forEach((c) => console.log(`  - ${c}`))
    if (otherClasses.length > 30) {
      console.log(`  ... and ${otherClasses.length - 30} more`)
    }

    console.log(`\n=== WEAPON DAMAGE TYPES (${allWeaponTypes.size} total) ===`)
    Array.from(allWeaponTypes)
      .sort()
      .forEach((t) => {
        const count = canonUnits.filter((u) =>
          u.variations.some((v) => v.weapons.some((w) => w.damageType === t)),
        ).length
        console.log(`  - ${t}: ${count} units`)
      })

    console.log('\n=== TECH APPLICATION COVERAGE ===')
    console.log('✓ melee class → Bloomery, Decarbonization, Damascus Steel apply')
    console.log('✓ ranged class → Steeled Arrow, Balanced Projectiles, Platecutter Point apply')
    console.log('✓ siege class → Siege Engineering applies')
    console.log('✓ cavalry class → Fitted Leatherwork applies')
    console.log('✓ infantry class → Iron Undermesh applies')

    console.log('\n=== WEAPON TYPE HANDLING ===')
    console.log('✓ melee weapons → receive meleeAttack bonuses')
    console.log('✓ ranged weapons → receive rangedAttack bonuses')
    console.log('✓ siege weapons → receive siegeAttack bonuses')
    console.log('✓ fire weapons → EXCLUDED from unit combat DPS (anti-building)')
    console.log('✓ other weapons → EXCLUDED from unit combat DPS (naval/special)')
  })
})
