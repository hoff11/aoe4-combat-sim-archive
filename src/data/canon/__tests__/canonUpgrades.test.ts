import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUpgrades } from '../buildCanonUpgrades'

describe('buildCanonUpgrades', () => {
  it('produces at least one upgrade', () => {
    const snap = loadRawSnapshotNode()
    const upgrades = buildCanonUpgrades(snap.upgrades.data)
    expect(upgrades.length).toBeGreaterThan(0)
  })

  it('every upgrade has at least one variation', () => {
    const snap = loadRawSnapshotNode()
    const upgrades = buildCanonUpgrades(snap.upgrades.data)

    for (const u of upgrades) {
      expect(u.id.length).toBeGreaterThan(0)
      expect(Array.isArray(u.variations)).toBe(true)
      expect(u.variations.length).toBeGreaterThan(0)
    }
  })
})
