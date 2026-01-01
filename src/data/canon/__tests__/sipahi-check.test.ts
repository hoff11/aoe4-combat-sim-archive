import { describe, expect, it } from 'vitest'
import { buildCanonUnits } from '../buildCanonUnits'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'

describe('Sipahi unit building assignment', () => {
  it('should assign sipahi to stable not barracks', () => {
    const raw = loadRawSnapshotNode()
    const canonUnits = buildCanonUnits(raw.units.data)
    const sipahi = canonUnits.find((u) => u.id === 'sipahi')

    expect(sipahi).toBeDefined()
    console.log('\nSipahi variations detail:')
    sipahi?.variations.forEach((v, i) => {
      console.log(`\n  [${i}] ${v.name} (Age ${v.age})`)
      console.log(`      Civ: ${v.civs?.[0] || 'undefined'}`)
      console.log(`      ProducedBy: ${v.producedBy?.join(', ')}`)
      console.log(`      Cost: ${v.cost ? JSON.stringify(v.cost) : 'undefined'}`)
      console.log(`      HP: ${v.hitpoints}`)
      console.log(`      Weapons: ${v.weapons.length}`)
    })

    // Sipahi is a cavalry unit
    // Ottoman sipahi should be produced by stable
    // Byzantine sipahi (mercenary) should be produced by golden-horn-tower/mercenary-house
    const ottomanVariations = sipahi?.variations.filter((v) => v.civs?.[0] === 'ot')
    const byzantineVariations = sipahi?.variations.filter((v) => v.civs?.[0] === 'by')

    // Ottoman variants should have stable
    const ottomanHaveStable = ottomanVariations?.every((v) => v.producedBy?.includes('stable'))
    expect(ottomanHaveStable).toBe(true)

    // Byzantine mercenary variants should have mercenary buildings
    const byzantineHaveMercenaryBuildings = byzantineVariations?.every(
      (v) =>
        v.producedBy?.includes('golden-horn-tower') || v.producedBy?.includes('mercenary-house'),
    )
    expect(byzantineHaveMercenaryBuildings).toBe(true)

    // No variation should have 'barracks' (cavalry shouldn't be in barracks)
    const noVariationHasBarracks = sipahi?.variations.every(
      (v) => !v.producedBy?.includes('barracks'),
    )
    expect(noVariationHasBarracks).toBe(true)
  })
})
