import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../loadRawSnapshot.node'

describe('raw snapshots', () => {
  it('loads latest snapshot and has envelopes', () => {
    const snap = loadRawSnapshotNode()
    expect(typeof snap.version).toBe('string')
    expect(Array.isArray(snap.units.data)).toBe(true)
    expect(Array.isArray(snap.technologies.data)).toBe(true)
    expect(Array.isArray(snap.upgrades.data)).toBe(true)
  })

  it('has non-trivial counts', () => {
    const snap = loadRawSnapshotNode()
    expect(snap.units.data.length).toBeGreaterThan(50)
    expect(snap.technologies.data.length).toBeGreaterThan(500)
    expect(snap.upgrades.data.length).toBeGreaterThan(20)
  })
})
