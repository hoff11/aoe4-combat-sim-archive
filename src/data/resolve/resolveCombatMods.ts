// src/data/resolve/resolveCombatMods.ts
import type { CanonTechnology, CanonUnitVariation } from '../canon/canonTypes'
import type {
  TeamCombatMods,
  CombatEffect,
  CombatSelector,
  CombatStatId,
  CombatOp,
} from './combatModsTypes'

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function toStatId(property: string): CombatStatId | null {
  switch (norm(property)) {
    case 'meleeattack':
      return 'meleeAttack'
    case 'rangedattack':
      return 'rangedAttack'
    case 'siegeattack':
      return 'siegeAttack'
    case 'meleearmor':
      return 'meleeArmor'
    case 'rangedarmor':
      return 'rangedArmor'
    case 'hitpoints':
      return 'hitpoints'
    case 'attackspeed':
      return 'attackSpeed'
    case 'range':
    case 'maxrange':
      return 'range'
    default:
      return null
  }
}

function toOp(effect: string): CombatOp | null {
  switch (norm(effect)) {
    case 'change':
      return 'add'
    case 'multiply':
    case 'mult':
      return 'mul'
    default:
      return null
  }
}

// src/data/resolve/resolveCombatMods.ts
// ... keep your existing imports ...

function parseSelector(selectRaw: any): CombatSelector {
  const sel: CombatSelector = {}

  if (selectRaw && typeof selectRaw === 'object') {
    const cls = (selectRaw as any).class
    if (Array.isArray(cls)) {
      const groups: string[][] = []
      for (const g of cls) {
        if (Array.isArray(g)) groups.push(g.map(norm).filter(Boolean))
        else if (typeof g === 'string') groups.push([norm(g)].filter(Boolean))
      }
      if (groups.length) sel.anyOfAll = groups
    }

    const ids = (selectRaw as any).id
    if (Array.isArray(ids)) {
      const u = ids.map(String).map(norm).filter(Boolean)
      if (u.length) sel.unitIds = u
    }
  }

  if (!sel.anyOfAll && !sel.unitIds) sel.anyOfAll = [[]]
  return sel
}

// NEW: like parseSelector but returns undefined if empty/unprovided
function parseOptionalSelector(raw: any): CombatSelector | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const sel = parseSelector(raw)

  // parseSelector always returns something (default [[]]); for OPTIONAL,
  // treat "global" default as undefined.
  const isGlobal =
    sel.anyOfAll?.length === 1 &&
    sel.anyOfAll[0]?.length === 0 &&
    (!sel.unitIds || sel.unitIds.length === 0)

  return isGlobal ? undefined : sel
}

function parseCombatEffect(args: { techId: string; raw: any }): CombatEffect | null {
  const r = args.raw
  if (!r || typeof r !== 'object') return null

  const stat = toStatId((r as any).property)
  if (!stat) return null

  const op = toOp((r as any).effect)
  if (!op) return null

  const value = Number((r as any).value)
  if (!Number.isFinite(value)) return null

  const select = parseSelector((r as any).select)

  // NEW: target is optional and has same selector structure (class/id)
  const target = parseOptionalSelector((r as any).target)

  return {
    stat,
    op,
    value,
    select,
    target,
    sourceId: args.techId,
  }
}

export function buildTechIndex(techs: readonly CanonTechnology[]): Map<string, CanonTechnology> {
  const m = new Map<string, CanonTechnology>()
  for (const t of techs) m.set(norm(t.id), t)
  return m
}

export function resolveTeamCombatMods(args: {
  techById: Map<string, CanonTechnology>
  selectedTechIds: readonly string[]
}): TeamCombatMods {
  const effects: CombatEffect[] = []
  const ids = [...new Set([...args.selectedTechIds].map(norm).filter(Boolean))].sort()

  for (const id of ids) {
    const t = args.techById.get(id)
    if (!t) continue
    for (const e of t.effects) {
      const ce = parseCombatEffect({ techId: t.id, raw: e.raw })
      if (ce) effects.push(ce)
    }
  }

  return { effects }
}

export function resolveUnitCombatMods(args: {
  techById: Map<string, CanonTechnology>
  unitTechIds: readonly string[]
}): TeamCombatMods {
  return resolveTeamCombatMods({ techById: args.techById, selectedTechIds: args.unitTechIds })
}

/**
 * Check if a unit variation matches a combat selector.
 *
 * MATCH RULES:
 * 1. If selector has unitIds and unit.baseUnitId is in the list: MATCH
 * 2. If selector has anyOfAll groups:
 *    For each group, check if unit has ALL classes in that group
 *    If any group fully matches: MATCH
 * 3. Default (no selector criteria): NO MATCH (empty selector is invalid)
 *
 * @param v Unit variation being checked
 * @param sel Selector criteria
 * @returns true if unit matches the selector
 *
 * @example
 * ```
 * const hasArmorClass = matchesSelector(unit, { anyOfAll: [["armored"]] })
 * const isKnight = matchesSelector(unit, { unitIds: ["knight"] })
 * const isMeleeHeavy = matchesSelector(unit, { anyOfAll: [["melee", "heavy"]] })
 * ```
 */
export function matchesSelector(v: CanonUnitVariation, sel: CombatSelector): boolean {
  const baseUnitId = norm(v.baseUnitId)
  const classes = new Set((v.classes ?? []).map(norm))

  if (sel.unitIds && sel.unitIds.includes(baseUnitId)) return true

  if (sel.anyOfAll) {
    for (const group of sel.anyOfAll) {
      let ok = true
      for (const need of group) {
        if (!need) continue
        if (!classes.has(norm(need))) {
          ok = false
          break
        }
      }
      if (ok) return true
    }
  }

  return false
}
