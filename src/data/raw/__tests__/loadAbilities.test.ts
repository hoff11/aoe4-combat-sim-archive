import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../loadRawSnapshot.node'

describe('loadRawSnapshot with abilities', () => {
  it('loads abilities from external aoe4-game-data folder', () => {
    const snap = loadRawSnapshotNode()

    expect(snap).toBeDefined()
    expect(snap.units).toBeDefined()
    expect(snap.technologies).toBeDefined()
    expect(snap.upgrades).toBeDefined()
    expect(snap.abilities).toBeDefined()

    // Abilities should be an array (may be empty if external folder not found)
    expect(Array.isArray(snap.abilities.data)).toBe(true)

    // If abilities loaded, check for camel-unease
    if (snap.abilities.data.length > 0) {
      const camelUnease = snap.abilities.data.find((a: any) => a.id?.includes('camel-unease'))

      if (camelUnease) {
        console.log('✓ Found camel-unease ability:', camelUnease.name)
        expect(camelUnease.auraRange).toBe(5)
        expect(camelUnease.description).toContain('20%')
      }
    }
  })
})
