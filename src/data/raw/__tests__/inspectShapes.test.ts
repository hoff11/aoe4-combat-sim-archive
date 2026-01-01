import { describe, it } from 'vitest'
import { loadRawSnapshotNode } from '../loadRawSnapshot.node'

function topKeys(items: any[], limit = 30) {
  const counts = new Map<string, number>()
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    for (const k of Object.keys(it)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

describe('inspect snapshot shapes', () => {
  it('prints top keys for units/tech/upgrades (run locally)', () => {
    const snap = loadRawSnapshotNode()
    console.log('SNAPSHOT', snap.version)
    console.log('UNITS top keys:', topKeys(snap.units.data))
    console.log('TECH top keys:', topKeys(snap.technologies.data))
    console.log('UPGRADES top keys:', topKeys(snap.upgrades.data))
  })
})
