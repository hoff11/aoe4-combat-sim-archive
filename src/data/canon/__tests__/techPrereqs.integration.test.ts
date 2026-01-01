// src/data/canon/__tests__/techPrereqs.integration.test.ts
import { describe, it, expect } from 'vitest'
import { expandTechSelection } from '../resolveTechPrereqs'
import { buildCanonTechnologies } from '../buildCanonTechnologies'
import { loadRawSnapshot } from '../../raw/loadRawSnapshot'

describe('Tech Prerequisites Integration', () => {
  it('should auto-select Bloomery when selecting Decarbonization (real data)', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)

    // Find English Decarbonization (tier 2)
    const decarbTech = canonTechs.find(
      (t) => t.id.startsWith('decarbonization') && t.civs.includes('en'),
    )
    expect(decarbTech).toBeDefined()

    if (!decarbTech) return

    const result = expandTechSelection(decarbTech.id, true, [], canonTechs)

    // Should include itself
    expect(result).toContain(decarbTech.id)

    // Should auto-include Bloomery (tier 1)
    const bloomeryTech = canonTechs.find(
      (t) => t.id.startsWith('bloomery') && t.civs.includes('en'),
    )
    expect(bloomeryTech).toBeDefined()
    expect(result).toContain(bloomeryTech!.id)

    // Should NOT include Damascus Steel (tier 3)
    const damascusTech = canonTechs.find(
      (t) => t.id.startsWith('damascus-steel') && t.civs.includes('en'),
    )
    expect(damascusTech).toBeDefined()
    expect(result).not.toContain(damascusTech!.id)
  })

  it('should auto-select all tiers when selecting Damascus Steel (real data)', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)

    // Find English Damascus Steel (tier 3)
    const damascusTech = canonTechs.find(
      (t) => t.id.startsWith('damascus-steel') && t.civs.includes('en'),
    )
    expect(damascusTech).toBeDefined()

    if (!damascusTech) return

    const result = expandTechSelection(damascusTech.id, true, [], canonTechs)

    // Should include all 3 tiers
    const bloomeryTech = canonTechs.find(
      (t) => t.id.startsWith('bloomery') && t.civs.includes('en'),
    )
    const decarbTech = canonTechs.find(
      (t) => t.id.startsWith('decarbonization') && t.civs.includes('en'),
    )

    expect(result).toContain(bloomeryTech!.id)
    expect(result).toContain(decarbTech!.id)
    expect(result).toContain(damascusTech.id)
  })

  it('should cascade disable when disabling tier 1 (real data)', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)

    // Get all 3 tiers for English
    const bloomeryTech = canonTechs.find(
      (t) => t.id.startsWith('bloomery') && t.civs.includes('en'),
    )
    const decarbTech = canonTechs.find(
      (t) => t.id.startsWith('decarbonization') && t.civs.includes('en'),
    )
    const damascusTech = canonTechs.find(
      (t) => t.id.startsWith('damascus-steel') && t.civs.includes('en'),
    )

    expect(bloomeryTech).toBeDefined()
    expect(decarbTech).toBeDefined()
    expect(damascusTech).toBeDefined()

    // Start with all 3 selected
    const current = [bloomeryTech!.id, decarbTech!.id, damascusTech!.id]

    // Disable tier 1
    const result = expandTechSelection(bloomeryTech!.id, false, current, canonTechs)

    // All tiers should be disabled
    expect(result).not.toContain(bloomeryTech!.id)
    expect(result).not.toContain(decarbTech!.id)
    expect(result).not.toContain(damascusTech!.id)
  })

  it('should handle ranged armor tech chain (real data)', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)

    // Find ranged armor techs for English
    const rangedArmorTechs = canonTechs
      .filter((t) => t.civs.includes('en'))
      .filter((t) => t.classes?.some((c: string) => c.includes('Ranged Armor Technology')))
      .sort((a, b) => (a.age ?? 0) - (b.age ?? 0))

    expect(rangedArmorTechs.length).toBeGreaterThanOrEqual(3)

    const tier3 = rangedArmorTechs.find((t) => t.classes?.some((c: string) => c.includes('3/3')))
    expect(tier3).toBeDefined()

    const result = expandTechSelection(tier3!.id, true, [], canonTechs)

    // Should auto-select all 3 tiers
    expect(result).toContain(rangedArmorTechs[0].id) // Tier 1
    expect(result).toContain(rangedArmorTechs[1].id) // Tier 2
    expect(result).toContain(tier3!.id) // Tier 3
  })

  it('should not affect non-tiered techs', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)

    // Find a non-tiered tech (e.g., university tech)
    const universityTech = canonTechs.find((t) =>
      t.classes?.some((c: string) => c.includes('university')),
    )

    if (!universityTech) {
      // If no university tech found, use any tech without tiered marker
      const nonTieredTech = canonTechs.find(
        (t) => !t.classes?.some((c: string) => c.includes('tiered')),
      )
      expect(nonTieredTech).toBeDefined()

      const result = expandTechSelection(nonTieredTech!.id, true, [], canonTechs)
      expect(result).toEqual([nonTieredTech!.id])
      return
    }

    const result = expandTechSelection(universityTech.id, true, [], canonTechs)
    // Should only add itself, no prerequisites
    expect(result).toContain(universityTech.id)
  })
})
