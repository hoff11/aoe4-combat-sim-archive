import { describe, expect, it, beforeAll } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'
import { resolveTechLines } from '../resolveTechLines'
import type { CanonTechnology } from '../../canon/canonTypes'

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

describe('resolveTechLines – Comprehensive Edge Cases', () => {
  let techs: CanonTechnology[] = []
  let techById: Map<string, CanonTechnology> = new Map()

  beforeAll(() => {
    console.log('[resolveTechLines] Loading snapshot...')
    const raw = loadRawSnapshotNode()
    techs = buildCanonTechnologies(raw.technologies.data)

    techById = new Map<string, CanonTechnology>()
    for (const t of techs) techById.set(norm(t.id), t)
    console.log(`[resolveTechLines] Loaded ${techs.length} techs`)
  })

  // ==================== Basic Behavior ====================

  it('returns empty arrays for empty input', () => {
    const { techIds, unknownIds } = resolveTechLines({ techById, selectedTechIds: [] })
    expect(techIds).toEqual([])
    expect(unknownIds).toEqual([])
  })

  it('returns single tech when single valid id provided', () => {
    const id = techs[0]?.id
    if (!id) throw new Error('No techs in snapshot')

    const { techIds, unknownIds } = resolveTechLines({ techById, selectedTechIds: [id] })
    expect(techIds.length).toBe(1)
    expect(norm(techIds[0])).toBe(norm(id))
    expect(unknownIds.length).toBe(0)
  })

  it('returns all techs when each has different baseId', () => {
    const unique = new Map<string, CanonTechnology>()
    for (const t of techs) {
      const base = norm(t.baseId || t.id)
      if (!unique.has(base)) unique.set(base, t)
    }

    const ids = Array.from(unique.values())
      .slice(0, 5)
      .map((t) => t.id)
    const { techIds } = resolveTechLines({ techById, selectedTechIds: ids })
    expect(techIds.length).toBe(ids.length)
  })

  // ==================== Tech Lines & Tiering ====================

  it('collapses multiple selections in same line to single best', () => {
    const byBase = new Map<string, CanonTechnology[]>()
    for (const t of techs) {
      const base = norm(t.baseId || t.id)
      const arr = byBase.get(base) ?? []
      arr.push(t)
      byBase.set(base, arr)
    }

    const multiTech = Array.from(byBase.values()).find((arr) => arr.length > 1)
    if (!multiTech) throw new Error('No multi-tech lines found')

    const ids = multiTech.map((t) => t.id)
    const { techIds: result } = resolveTechLines({ techById, selectedTechIds: ids })
    expect(result.length).toBe(1)
  })

  it('prefers higher age within a tech line', () => {
    const byBase = new Map<string, CanonTechnology[]>()
    for (const t of techs) {
      const base = norm(t.baseId || t.id)
      const arr = byBase.get(base) ?? []
      arr.push(t)
      byBase.set(base, arr)
    }

    const multiAge = Array.from(byBase.values()).find((arr) => {
      const ages = new Set(arr.map((t) => t.age ?? -1))
      return ages.size > 1
    })

    if (!multiAge || multiAge.length < 2) return

    multiAge.sort((a, b) => (a.age ?? -1) - (b.age ?? -1))
    const low = multiAge[0]
    const high = multiAge[multiAge.length - 1]

    const { techIds: result } = resolveTechLines({
      techById,
      selectedTechIds: [low.id, high.id],
    })
    expect(result.map(norm)).toContain(norm(high.id))
  })

  it('picks tier member (baseId != id) over base when same age', () => {
    // Find a line with a base and a tier member at same age
    const byBase = new Map<string, CanonTechnology[]>()
    for (const t of techs) {
      const base = norm(t.baseId || t.id)
      const arr = byBase.get(base) ?? []
      arr.push(t)
      byBase.set(base, arr)
    }

    const candidate = Array.from(byBase.values()).find((arr) => {
      if (arr.length < 2) return false
      const sameAge = arr.filter((t) => t.age === arr[0]?.age)
      if (sameAge.length < 2) return false
      const hasTier = sameAge.some((t) => norm(t.baseId) !== norm(t.id))
      const hasBase = sameAge.some((t) => norm(t.baseId) === norm(t.id))
      return hasTier && hasBase
    })

    if (!candidate) return // skip if no such line exists

    const { techIds: result } = resolveTechLines({
      techById,
      selectedTechIds: candidate.map((t) => t.id),
    })
    expect(result.length).toBe(1)
    const picked = result[0]
    expect(norm(picked)).not.toBe(norm(candidate[0]?.id))
  })

  // ==================== Normalization & Casing ====================

  it('is case-insensitive for input ids', () => {
    const id = techs[0]?.id
    if (!id) throw new Error('No techs')

    const upper = id.toUpperCase()
    const lower = id.toLowerCase()
    const mixed = id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()

    const { techIds: a } = resolveTechLines({ techById, selectedTechIds: [upper] })
    const { techIds: b } = resolveTechLines({ techById, selectedTechIds: [lower] })
    const { techIds: c } = resolveTechLines({ techById, selectedTechIds: [mixed] })

    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('is order-invariant within a line', () => {
    const byBase = new Map<string, CanonTechnology[]>()
    for (const t of techs) {
      const base = norm(t.baseId || t.id)
      const arr = byBase.get(base) ?? []
      arr.push(t)
      byBase.set(base, arr)
    }

    const multiTech = Array.from(byBase.values()).find((arr) => arr.length > 1)
    if (!multiTech) throw new Error('No multi-tech lines')

    const ids = multiTech.map((t) => t.id)

    const { techIds: a } = resolveTechLines({ techById, selectedTechIds: ids })
    const { techIds: b } = resolveTechLines({ techById, selectedTechIds: [...ids].reverse() })
    const { techIds: c } = resolveTechLines({ techById, selectedTechIds: shuffle(ids) })

    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  // ==================== Unknown & Malformed Input ====================

  it('preserves unknown tech ids (does not drop them)', () => {
    const unknown = '__definitely_not_a_real_tech__'
    const { techIds, unknownIds } = resolveTechLines({ techById, selectedTechIds: [unknown] })
    expect(techIds).toEqual([])
    expect(unknownIds).toEqual([unknown])
  })

  it('mixes known and unknown techs', () => {
    const known = techs[0]?.id
    const unknown = '__unknown__'
    if (!known) throw new Error('No techs')

    const { techIds, unknownIds } = resolveTechLines({
      techById,
      selectedTechIds: [known, unknown],
    })
    expect(techIds.length).toBe(1)
    expect(norm(techIds[0])).toBe(norm(known))
    expect(unknownIds).toContain(unknown)
  })

  it('handles multiple unknown ids', () => {
    const unknowns = ['__unknown1__', '__unknown2__', '__unknown3__']
    const { techIds, unknownIds } = resolveTechLines({ techById, selectedTechIds: unknowns })
    expect(techIds.length).toBe(0)
    expect(unknownIds.length).toBe(3)
    expect(unknownIds).toEqual(expect.arrayContaining(unknowns))
  })

  it('filters out null/undefined/empty string ids', () => {
    const known = techs[0]?.id
    if (!known) throw new Error('No techs')

    const { techIds: result } = resolveTechLines({
      techById,
      selectedTechIds: [known, null, undefined, '', '  '] as any,
    })
    expect(result.length).toBe(1)
    expect(norm(result[0])).toBe(norm(known))
  })

  // ==================== Determinism & Stability ====================

  it('returns sorted output for deterministic comparison', () => {
    const ids = techs.slice(0, 10).map((t) => t.id)
    const { techIds: _result } = resolveTechLines({ techById, selectedTechIds: ids })

    const { techIds: a } = resolveTechLines({ techById, selectedTechIds: ids })
    const { techIds: b } = resolveTechLines({ techById, selectedTechIds: shuffle(ids) })

    expect(a).toEqual(b)
  })

  it('output is always sorted lexically (normalized)', () => {
    const ids = techs.slice(0, 10).map((t) => t.id)
    const { techIds: result } = resolveTechLines({ techById, selectedTechIds: ids })

    const normalized = result.map(norm)
    const sorted = [...normalized].sort()

    expect(normalized).toEqual(sorted)
  })

  // ==================== Special Cases ====================

  it('handles techs with missing/empty baseId', () => {
    // Some techs might have baseId = ''
    const noBase = techs.find((t) => !t.baseId || norm(t.baseId) === '')
    if (!noBase) return

    const { techIds: result } = resolveTechLines({ techById, selectedTechIds: [noBase.id] })
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('handles duplicate selections (same id twice)', () => {
    const id = techs[0]?.id
    if (!id) throw new Error('No techs')

    const { techIds: result } = resolveTechLines({
      techById,
      selectedTechIds: [id, id, id],
    })
    expect(result.length).toBe(1)
    expect(norm(result[0])).toBe(norm(id))
  })

  it('handles duplicate selections within a line', () => {
    const byBase = new Map<string, CanonTechnology[]>()
    for (const t of techs) {
      const base = norm(t.baseId || t.id)
      const arr = byBase.get(base) ?? []
      arr.push(t)
      byBase.set(base, arr)
    }

    const multiTech = Array.from(byBase.values()).find((arr) => arr.length > 1)
    if (!multiTech) return

    const ids = [multiTech[0]?.id, multiTech[1]?.id, multiTech[0]?.id].filter(Boolean)
    const { techIds: result } = resolveTechLines({ techById, selectedTechIds: ids })
    expect(result.length).toBe(1)
  })

  it('handles large selection (100+ techs)', () => {
    const ids = techs.slice(0, Math.min(100, techs.length)).map((t) => t.id)
    const { techIds: result } = resolveTechLines({ techById, selectedTechIds: ids })
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.length).toBeLessThanOrEqual(ids.length)
  })

  // ==================== Game Data Validation ====================

  it('all real techs in snapshot resolve to themselves when solo', () => {
    // Sample 20 random techs, verify each resolves to itself
    const sample = techs.slice(0, 20)
    for (const t of sample) {
      const { techIds: result } = resolveTechLines({ techById, selectedTechIds: [t.id] })
      expect(result.length).toBe(1)
      expect(norm(result[0])).toBe(norm(t.id))
    }
  })

  it('no tech resolves to a tech not in the input or its line members', () => {
    const sample = techs.slice(0, 20)
    for (const t of sample) {
      const { techIds: result } = resolveTechLines({ techById, selectedTechIds: [t.id] })

      // result should be t.id or another tech in the same line
      const base = norm(t.baseId || t.id)
      const line = techs.filter((x) => norm(x.baseId || x.id) === base).map((x) => norm(x.id))

      expect(line).toContain(norm(result[0]))
    }
  })
})

// ==================== Helper ====================

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
