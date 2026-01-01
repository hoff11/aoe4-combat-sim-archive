// src/data/canon/__tests__/resolveTechPrereqs.test.ts
import { describe, it, expect } from 'vitest'
import { expandTechSelection } from '../resolveTechPrereqs'
import type { CanonTechnology } from '../canonTypes'

describe('expandTechSelection', () => {
  // Mock blacksmith tech chain: Bloomery (age 2), Decarbonization (age 3), Damascus Steel (age 4)
  const mockBlacksmithChain: CanonTechnology[] = [
    {
      id: 'bloomery-2',
      baseId: 'bloomery',
      name: 'Bloomery',
      civs: ['en'],
      age: 2,
      classes: ['military_upgrade', 'scar_tiered_upgrade', 'Melee Damage Technology 1/3'],
      effects: [],
    },
    {
      id: 'decarbonization-3',
      baseId: 'decarbonization',
      name: 'Decarbonization',
      civs: ['en'],
      age: 3,
      classes: ['military_upgrade', 'scar_tiered_upgrade', 'Melee Damage Technology 2/3'],
      effects: [],
    },
    {
      id: 'damascus-steel-4',
      baseId: 'damascus-steel',
      name: 'Damascus Steel',
      civs: ['en'],
      age: 4,
      classes: ['military_upgrade', 'scar_tiered_upgrade', 'Melee Damage Technology 3/3'],
      effects: [],
    },
  ]

  // Mock a standalone tech (no chain)
  const mockStandaloneTech: CanonTechnology = {
    id: 'university-tech-1',
    baseId: 'university-tech-1',
    name: 'Biology',
    civs: ['en'],
    age: 3,
    effects: [],
  }

  it('should enable tier 1 when toggling tier 1', () => {
    const result = expandTechSelection('bloomery-2', true, [], mockBlacksmithChain)
    expect(result).toContain('bloomery-2')
    expect(result).not.toContain('decarbonization-3')
    expect(result).not.toContain('damascus-steel-4')
  })

  it('should enable tier 1 and 2 when toggling tier 2', () => {
    const result = expandTechSelection('decarbonization-3', true, [], mockBlacksmithChain)
    expect(result).toContain('bloomery-2')
    expect(result).toContain('decarbonization-3')
    expect(result).not.toContain('damascus-steel-4')
  })

  it('should enable tier 1, 2, and 3 when toggling tier 3', () => {
    const result = expandTechSelection('damascus-steel-4', true, [], mockBlacksmithChain)
    expect(result).toContain('bloomery-2')
    expect(result).toContain('decarbonization-3')
    expect(result).toContain('damascus-steel-4')
  })

  it('should disable all tiers when disabling tier 1', () => {
    const current = ['bloomery-2', 'decarbonization-3', 'damascus-steel-4']
    const result = expandTechSelection('bloomery-2', false, current, mockBlacksmithChain)
    expect(result).not.toContain('bloomery-2')
    expect(result).not.toContain('decarbonization-3')
    expect(result).not.toContain('damascus-steel-4')
  })

  it('should disable tier 2 and 3 when disabling tier 2', () => {
    const current = ['bloomery-2', 'decarbonization-3', 'damascus-steel-4']
    const result = expandTechSelection('decarbonization-3', false, current, mockBlacksmithChain)
    expect(result).toContain('bloomery-2')
    expect(result).not.toContain('decarbonization-3')
    expect(result).not.toContain('damascus-steel-4')
  })

  it('should only disable tier 3 when disabling tier 3', () => {
    const current = ['bloomery-2', 'decarbonization-3', 'damascus-steel-4']
    const result = expandTechSelection('damascus-steel-4', false, current, mockBlacksmithChain)
    expect(result).toContain('bloomery-2')
    expect(result).toContain('decarbonization-3')
    expect(result).not.toContain('damascus-steel-4')
  })

  it('should preserve other tech selections when expanding', () => {
    const current = ['university-tech-1']
    const result = expandTechSelection('decarbonization-3', true, current, [
      ...mockBlacksmithChain,
      mockStandaloneTech,
    ])
    expect(result).toContain('university-tech-1')
    expect(result).toContain('bloomery-2')
    expect(result).toContain('decarbonization-3')
  })

  it('should handle standalone techs without chains', () => {
    const result = expandTechSelection('university-tech-1', true, [], [mockStandaloneTech])
    expect(result).toEqual(['university-tech-1'])
  })

  it('should handle unknown tech IDs gracefully', () => {
    const result = expandTechSelection('unknown-tech', true, [], mockBlacksmithChain)
    expect(result).toContain('unknown-tech')
  })

  it('should handle techs with same baseId but unsorted input', () => {
    // Test with techs in random order
    const unsortedChain = [mockBlacksmithChain[2], mockBlacksmithChain[0], mockBlacksmithChain[1]]
    const result = expandTechSelection('damascus-steel-4', true, [], unsortedChain)
    expect(result).toContain('bloomery-2')
    expect(result).toContain('decarbonization-3')
    expect(result).toContain('damascus-steel-4')
  })

  it('should handle partial selection when enabling higher tier', () => {
    // Only tier 1 selected, enable tier 3
    const current = ['bloomery-2']
    const result = expandTechSelection('damascus-steel-4', true, current, mockBlacksmithChain)
    expect(result).toContain('bloomery-2')
    expect(result).toContain('decarbonization-3')
    expect(result).toContain('damascus-steel-4')
  })

  it('should maintain idempotency - toggling same tier twice', () => {
    const result1 = expandTechSelection('decarbonization-3', true, [], mockBlacksmithChain)
    const result2 = expandTechSelection('decarbonization-3', true, result1, mockBlacksmithChain)
    expect(result1).toEqual(result2)
  })
})
