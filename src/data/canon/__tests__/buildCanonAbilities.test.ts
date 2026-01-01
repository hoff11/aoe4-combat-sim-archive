// src/data/canon/__tests__/buildCanonAbilities.test.ts
import { describe, it, expect } from 'vitest'
import { buildCanonAbilities } from '../buildCanonAbilities'
import { loadRawAbilitiesNode } from '../../raw/loadRawAbilities.node'

describe('buildCanonAbilities', () => {
  it('loads and filters combat-relevant abilities', () => {
    const rawAbilities = loadRawAbilitiesNode()
    const canon = buildCanonAbilities(rawAbilities.abilities)

    expect(canon.byId.size).toBeGreaterThan(0)
    console.log(`Loaded ${canon.byId.size} combat abilities`)

    // Check for Camel Unease
    const camelUnease = canon.byId.get('ability-camel-unease')
    if (camelUnease) {
      expect(camelUnease.name).toBe('Camel Unease')
      expect(camelUnease.activation).toBe('always')
      expect(camelUnease.auraRange).toBe(5)
      expect(camelUnease.description).toContain('20% less damage')

      // Check parsed effects
      expect(camelUnease.effects.length).toBeGreaterThan(0)
      const dmgEffect = camelUnease.effects.find((e) => e.stat === 'damage')
      expect(dmgEffect).toBeDefined()
      expect(dmgEffect?.op).toBe('mul')
      expect(dmgEffect?.value).toBe(0.8) // 20% reduction = 0.8x

      console.log('Camel Unease effect:', dmgEffect)
    }
  })

  it('links abilities to units', () => {
    const rawAbilities = loadRawAbilitiesNode()
    const canon = buildCanonAbilities(rawAbilities.abilities)

    // Desert raider should have abilities
    const desertRaiderAbilities = canon.byUnit.get('desert-raider')
    expect(desertRaiderAbilities).toBeDefined()

    if (desertRaiderAbilities) {
      console.log(`Desert raider has ${desertRaiderAbilities.length} abilities:`)
      desertRaiderAbilities.forEach((ab) => {
        console.log(`  - ${ab.name} (${ab.baseId})`)
      })

      // Should have Camel Unease
      const hasCamelUnease = desertRaiderAbilities.some(
        (ab) => ab.baseId === 'ability-camel-unease',
      )
      expect(hasCamelUnease).toBe(true)
    }
  })

  it('filters out non-combat abilities', () => {
    const rawAbilities = loadRawAbilitiesNode()
    const canon = buildCanonAbilities(rawAbilities.abilities)

    // Conversion should be filtered out (not combat-relevant)
    const conversion = canon.byId.get('ability-conversion')
    expect(conversion).toBeUndefined()
  })
})
