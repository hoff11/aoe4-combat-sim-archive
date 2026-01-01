import { describe, it } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'

function keysOf(o: any) {
  if (!o || typeof o !== 'object') return []
  return Object.keys(o).sort()
}

describe('inspect unit variation shape (dev-only)', () => {
  it('prints a sample raw unit variation keys', () => {
    const snap = loadRawSnapshotNode()

    const firstUnit = snap.units.data.find(
      (u: any) => Array.isArray(u?.variations) && u.variations.length > 0,
    )
    const firstVar = firstUnit?.variations?.[0]

    console.log('UNIT id/name:', firstUnit?.id, firstUnit?.name)
    console.log('UNIT keys:', keysOf(firstUnit))

    console.log('VAR id/name:', firstVar?.id, firstVar?.name)
    console.log('VAR keys:', keysOf(firstVar))

    // Try common weapon containers
    for (const k of ['weapons', 'weapon', 'attacks', 'attack', 'combat', 'stats']) {
      if (firstVar?.[k] != null) {
        console.log(`VAR.${k}:`, firstVar[k])
      }
    }
    console.log('VAR.armor:', firstVar?.armor)
    console.log('VAR.costs:', firstVar?.costs)

    const maaUnit = snap.units.data.find(
      (u: any) =>
        String(u?.id).includes('manatarms') ||
        String(u?.name).toLowerCase().includes('man-at-arms'),
    )
    const maaVar = maaUnit?.variations?.[0]
    console.log('Maa UNIT id/name:', maaUnit?.id, maaUnit?.name)
    console.log('Maa VAR.armor:', maaVar?.armor)
    console.log('Maa VAR.costs:', maaVar?.costs)

    const mangudaiUnit = snap.units.data.find((u: any) =>
      String(u?.id).toLowerCase().includes('mangudai'),
    )
    const mangudaiVar = mangudaiUnit?.variations?.[0]
    console.log('\nMANGUDAI UNIT id/name:', mangudaiUnit?.id, mangudaiUnit?.name)
    console.log('Mangudai VAR keys:', keysOf(mangudaiVar))
    console.log('Mangudai VAR.movement:', mangudaiVar?.movement)
    console.log('Maa VAR.movement:', maaVar?.movement)
  })
})
