import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonTechnologies } from '../buildCanonTechnologies'

describe('buildCanonTechnologies', () => {
  it('produces at least one technology', () => {
    const snap = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(snap.technologies.data)
    expect(techs.length).toBeGreaterThan(0)
  })

  it('every technology has an effects array (possibly empty)', () => {
    const snap = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(snap.technologies.data)

    for (const t of techs) {
      expect(typeof t.id).toBe('string')
      expect(t.id.length).toBeGreaterThan(0)
      expect(Array.isArray(t.effects)).toBe(true)
    }
  })

  it('many technologies have at least one effect', () => {
    const snap = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(snap.technologies.data)

    const withEffects = techs.filter((t) => t.effects.length > 0).length
    expect(withEffects).toBeGreaterThan(500) // based on your earlier count (~1649 had effects)
  })
})
