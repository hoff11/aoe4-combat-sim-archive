import { describe, expect, it } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'
import { buildTechCatalogView } from '../buildTechCatalogView'

describe('buildTechCatalogView', () => {
  const raw = loadRawSnapshotNode()
  const techs = buildCanonTechnologies(raw.technologies.data)

  it('computes availability by civ and age gates', () => {
    const view = buildTechCatalogView({
      techs,
      civ: 'english',
      age: 2,
    })

    expect(view.length).toBeGreaterThan(0)

    for (const t of view) {
      if (!t.isAvailable) continue

      if (t.age != null) {
        expect(t.age).toBeLessThanOrEqual(2)
      }

      if (t.civs.length > 0) {
        expect(t.civs.map((c) => String(c).toLowerCase())).toContain('english')
      }
    }
  })

  it('detects combat-impacting technologies via resolved effects', () => {
    const view = buildTechCatalogView({
      techs,
      civ: 'english',
      age: 4,
    })

    expect(view.some((t) => t.hasCombatEffects)).toBe(true)
  })

  it('detects target-conditional bonus-vs techs', () => {
    const view = buildTechCatalogView({
      techs,
      civ: 'english',
      age: 4,
    })

    expect(view.some((t) => t.hasTargetConditional)).toBe(true)
  })

  it('flags tiered tech lines using baseId', () => {
    const view = buildTechCatalogView({
      techs,
      civ: 'english',
      age: 4,
    })

    expect(view.some((t) => t.isTieredLineCandidate)).toBe(true)
  })
})
