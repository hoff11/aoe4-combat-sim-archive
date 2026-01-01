import { describe, expect, it } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'
import { resolveTechLines } from '../resolveTechLines'

describe('resolveTechLines', () => {
  const raw = loadRawSnapshotNode()
  const techs = buildCanonTechnologies(raw.technologies.data)

  const techById = new Map<string, any>()
  for (const t of techs) techById.set(String(t.id).toLowerCase(), t)

  function pickAnyTieredLine() {
    const byBase = new Map<string, any[]>()
    for (const t of techs) {
      const base = String(t.baseId ?? t.id).toLowerCase()
      const arr = byBase.get(base) ?? []
      arr.push(t)
      byBase.set(base, arr)
    }

    // find a base group with 2+ members
    for (const [, arr] of byBase) {
      if (arr.length < 2) continue
      // prefer lines with different ages if possible
      arr.sort((a, b) => (a.age ?? -1) - (b.age ?? -1))
      return arr
    }
    throw new Error('No tiered tech line found in technologies data')
  }

  it('collapses multiple selections in the same baseId line to a single effective tech', () => {
    const line = pickAnyTieredLine()
    const ids = line.map((t) => t.id)

    const { techIds: resolved } = resolveTechLines({ techById, selectedTechIds: ids })
    expect(resolved.length).toBe(1)
  })

  it('is order-invariant for selections within a line', () => {
    const line = pickAnyTieredLine()
    const ids = line.map((t) => t.id)

    const { techIds: a } = resolveTechLines({ techById, selectedTechIds: ids })
    const { techIds: b } = resolveTechLines({ techById, selectedTechIds: [...ids].reverse() })

    expect(a).toEqual(b)
  })

  it('prefers higher age within a line when ages differ', () => {
    const line = pickAnyTieredLine()

    // try to ensure we have at least 2 distinct ages; if not, skip this assertion
    const uniqAges = Array.from(new Set(line.map((t) => t.age ?? -1)))
    if (uniqAges.length < 2) return

    line.sort((x, y) => (x.age ?? -1) - (y.age ?? -1))
    const low = line[0]!.id
    const high = line[line.length - 1]!.id

    const { techIds: resolved } = resolveTechLines({ techById, selectedTechIds: [low, high] })
    expect(resolved).toEqual([String(high)])
  })

  it('keeps unrelated techs (different baseId) as separate selections', () => {
    // find two techs with different baseId
    const a = techs[0]
    const b = techs.find((t) => String(t.baseId ?? t.id) !== String(a.baseId ?? a.id))
    if (!a || !b) throw new Error('Could not find two techs with different baseId')

    const { techIds: resolved } = resolveTechLines({ techById, selectedTechIds: [a.id, b.id] })
    expect(resolved.length).toBe(2)
  })

  it('does not drop unknown ids', () => {
    const { techIds, unknownIds } = resolveTechLines({
      techById,
      selectedTechIds: ['__some_unknown_tech__'],
    })
    expect(techIds).toEqual([])
    expect(unknownIds).toEqual(['__some_unknown_tech__'])
  })
})
