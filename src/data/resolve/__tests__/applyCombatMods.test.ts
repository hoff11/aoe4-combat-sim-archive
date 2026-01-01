import { describe, it, expect } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUnits } from '../../canon/buildCanonUnits'
import { buildCanonTechnologies } from '../../canon/buildCanonTechnologies'
import { buildTechIndex, resolveTeamCombatMods, matchesSelector } from '../resolveCombatMods'
import {
  applyCombatModsToVariation,
  applyCombatModsToWeaponsAgainstDefender,
} from '../applyCombatMods'

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function maxWeaponDamage(v: any) {
  return Math.max(...(v.weapons ?? []).map((w: any) => Number(w.damageMax ?? 0)))
}

function findTech(techId: string) {
  const raw = loadRawSnapshotNode()
  const techs = buildCanonTechnologies(raw.technologies.data)
  const t = techs.find((x) => norm(x.id) === norm(techId))
  if (!t) throw new Error(`tech not found: ${techId}`)
  return t
}

function pickVariationForUnit(args: { unitId: string; civ: string }) {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)
  const u = units.find((x) => x.id === args.unitId)
  if (!u) throw new Error(`unit not found: ${args.unitId}`)

  const v = (u.variations ?? []).find((vv) => (vv.civs ?? []).includes(args.civ))
  if (!v) throw new Error(`no variation for unitId=${args.unitId} civ=${args.civ}`)
  return v
}

/**
 * Pick a real unit variation from a tech's select.id list, for a specific civ.
 * This avoids guessing which civ has "archer" etc.
 */
function pickUnitFromTechSelectIds(args: { techId: string; civ: string }) {
  const raw = loadRawSnapshotNode()
  const units = buildCanonUnits(raw.units.data)
  const tech = findTech(args.techId)

  // Find first effect that has select.id
  const effectRaw: any = tech.effects
    .map((e: any) => e.raw)
    .find((r: any) => Array.isArray(r?.select?.id))
  if (!effectRaw) throw new Error(`tech ${args.techId} has no select.id list to pick from`)

  const ids: string[] = effectRaw.select.id.map(String)

  for (const unitId of ids) {
    const u = units.find((x) => norm(x.id) === norm(unitId))
    if (!u) continue
    const v = (u.variations ?? []).find((vv) => (vv.civs ?? []).includes(args.civ))
    if (!v) continue
    return { unitId: u.id, variation: v }
  }

  throw new Error(`No usable unit from tech ${args.techId} select.id for civ=${args.civ}`)
}

describe('applyCombatModsToVariation', () => {
  it('applies rangedAttack +1 from platecutter-point-4 to a valid ja unit (select.id)', () => {
    const civ = 'ja'
    const techId = 'platecutter-point-4'

    const raw = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(raw.technologies.data)
    const techById = buildTechIndex(techs)

    const picked = pickUnitFromTechSelectIds({ techId, civ })
    const v = picked.variation

    const baseMax = maxWeaponDamage(v)

    const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
    expect(teamMods.effects.some((e) => e.sourceId === techId && e.stat === 'rangedAttack')).toBe(
      true,
    )

    const eff = applyCombatModsToVariation({ variation: v, teamMods })
    const effMax = Math.max(...eff.weapons.map((w) => Number(w.damageMax)))

    expect(effMax).toBe(baseMax + 1)
    expect(eff.applied.some((a) => a.sourceId === techId && a.stat === 'rangedAttack')).toBe(true)
  })

  it('does not apply platecutter-point-4 to a unit not in its select.id list', () => {
    const civ = 'ja'
    const techId = 'platecutter-point-4'

    const raw = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(raw.technologies.data)
    const techById = buildTechIndex(techs)

    // Pick a unit that exists for ja but is unlikely in the id list; fallback: take the first ja unit not in list
    const units = buildCanonUnits(raw.units.data)
    const tech = findTech(techId)
    const effectRaw: any = tech.effects
      .map((e: any) => e.raw)
      .find((r: any) => Array.isArray(r?.select?.id))
    const allowedIds = new Set((effectRaw?.select?.id ?? []).map((x: any) => norm(x)))

    const candidate = units
      .filter((u) => !allowedIds.has(norm(u.id)))
      .map((u) => {
        const v = (u.variations ?? []).find((vv) => (vv.civs ?? []).includes(civ))
        return v ? { u, v } : null
      })
      .find(Boolean) as any

    if (!candidate) throw new Error(`could not find a ja unit outside select.id list for ${techId}`)

    const v = candidate.v
    const baseMax = maxWeaponDamage(v)

    const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })
    const eff = applyCombatModsToVariation({ variation: v, teamMods })
    const effMax = Math.max(...eff.weapons.map((w) => Number(w.damageMax)))

    expect(effMax).toBe(baseMax)
    expect(eff.applied.some((a) => a.sourceId === techId)).toBe(false)
  })

  it('target-conditional bonus-vs techs (like odachi-3) are ignored for now', () => {
    const civ = 'ja'
    const unitId = 'samurai'
    const techId = 'odachi-3'

    const raw = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(raw.technologies.data)
    const techById = buildTechIndex(techs)

    const v = pickVariationForUnit({ unitId, civ })
    const baseMax = maxWeaponDamage(v)

    const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

    // We expect the mod to parse (it is meleeAttack change 4), BUT application should not occur
    // because the effect includes a 'target' condition and we have no defender context here.
    // (We can formalize this by extending parser later.)
    const eff = applyCombatModsToVariation({ variation: v, teamMods })
    const effMax = Math.max(...eff.weapons.map((w) => Number(w.damageMax)))

    expect(effMax).toBe(baseMax)
  })

  it('target-conditional bonus-vs techs (like odachi-3) are ignored in intrinsic stats', () => {
    const civ = 'ja'
    const unitId = 'samurai'
    const techId = 'odachi-3'

    const raw = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(raw.technologies.data)
    const techById = buildTechIndex(techs)

    const v = pickVariationForUnit({ unitId, civ })
    const baseMax = maxWeaponDamage(v)

    const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

    const eff = applyCombatModsToVariation({ variation: v, teamMods })
    const effMax = Math.max(...eff.weapons.map((w) => Number(w.damageMax)))

    expect(effMax).toBe(baseMax) // ✅ now true
  })

  it('target-conditional bonus-vs techs (like odachi-3) apply vs matching defender class', () => {
    const civ = 'ja'
    const techId = 'odachi-3'

    const raw = loadRawSnapshotNode()
    const techs = buildCanonTechnologies(raw.technologies.data)
    const techById = buildTechIndex(techs)

    const attacker = pickVariationForUnit({ unitId: 'samurai', civ })

    const teamMods = resolveTeamCombatMods({ techById, selectedTechIds: [techId] })

    // Grab the actual parsed effect (with target)
    const effect = teamMods.effects.find(
      (e) => e.sourceId === techId && e.stat === 'meleeAttack' && e.target,
    )
    if (!effect || !effect.target)
      throw new Error('odachi-3 meleeAttack effect with target not found')

    // Pick a real defender that matches the parsed target selector
    const units = buildCanonUnits(raw.units.data)
    let defender: any = null
    for (const u of units) {
      for (const v of u.variations ?? []) {
        if (matchesSelector(v, effect.target)) {
          defender = v
          break
        }
      }
      if (defender) break
    }
    if (!defender) throw new Error('no defender found matching odachi-3 target selector')

    const _baseMax = maxWeaponDamage(attacker)

    const out = applyCombatModsToWeaponsAgainstDefender({
      attacker,
      defender,
      teamMods,
    })

    const _effMax = Math.max(...out.weapons.map((w) => Number(w.damageMax)))
    const deltas = out.weapons.map((w, i) => ({
      base: attacker.weapons[i]?.damageMax ?? 0,
      eff: w.damageMax,
      delta: w.damageMax - (attacker.weapons[i]?.damageMax ?? 0),
    }))

    // At least one melee weapon must gain +4
    expect(deltas.some((d) => d.delta === effect.value)).toBe(true)

    expect(out.applied.some((a) => a.sourceId === techId && a.stat === 'meleeAttack')).toBe(true)
  })
  it('weapon damageType is normalized', () => {
    const raw = loadRawSnapshotNode()
    const units = buildCanonUnits(raw.units.data)

    const allowed = new Set(['melee', 'ranged', 'siege', 'fire', 'magic', 'other'])

    let checked = 0
    for (const u of units) {
      for (const v of u.variations) {
        for (const w of v.weapons as any[]) {
          const dt = String(w.damageType)
          if (!allowed.has(dt)) {
            throw new Error(
              `Non-normalized damageType="${dt}" on unit=${u.id} variation=${v.id} weapon=${w.name}`,
            )
          }
          checked++
          if (checked > 500) return
        }
      }
    }
  })
})
